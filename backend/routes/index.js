const express = require('express');
const multer = require('multer');
const MP3Tag = require('mp3tag.js');
const { Readable } = require('stream');
const { WritableStreamBuffer } = require('stream-buffers');
const { default: axios } = require('axios');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath);

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Helper: convert buffer to readable stream
function bufferToStream(buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

async function fetchImage(imageUrl) {
  const response = await fetch(imageUrl);
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

router.get('/status', async(req, res) => {
  res.send({message: "API is currently running!"});
})

router.post('/process-mp3', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const inputBuffer = file?.buffer;
    if (!inputBuffer) return res.status(400).json({ error: 'No file uploaded' });

    // Extract artist & song from filename
    const base_song_info = file.originalname.replace('.mp3', '').split('-');
    if (base_song_info.length < 2) {
      return res.status(400).json({ error: 'Filename must be in format "Artist - Title.mp3"' });
    }
    const base_artist = base_song_info[0].trim();
    const base_song = base_song_info[1].trim();

    // Get song metadata
    const song_info = await axios.get(`https://api.deezer.com/search?q=artist:"${base_artist}" track:"${base_song}"`);
    const album_id = song_info.data.data[0]?.album?.id;
    const album_info = await axios.get(`https://api.deezer.com/album/${album_id}`);
    const track_info = await axios.get(`https://api.deezer.com/album/${album_id}/tracks`);

    const formatted_song_info = {
      title: song_info.data.data[0].title,
      artist: song_info.data.data[0].artist.name,
      album: song_info.data.data[0].album.title,
      cover: song_info.data.data[0].album.cover_medium,
      genres: album_info.data.genres.data.map((g) => g.name).join(', '),
      release_date: album_info.data.release_date,
      track_no: track_info.data.data.find((t) => t.title === song_info.data.data[0].title)?.track_position,
    };

    // Convert audio to MP3 using FFmpeg
    const inputStream = bufferToStream(inputBuffer);
    const outputBuffer = new WritableStreamBuffer();

    await new Promise((resolve, reject) => {
      ffmpeg(inputStream)
        .toFormat('mp3')
        .audioCodec('libmp3lame')
        .on('end', resolve)
        .on('error', reject)
        .pipe(outputBuffer, { end: true });
    });

    const convertedBuffer = outputBuffer.getContents();

    // Tag the converted MP3
    const mp3tag = new MP3Tag(convertedBuffer);
    mp3tag.read();
    if (mp3tag.error) {
      console.error('Tag read error:', mp3tag.error);
      return res.status(500).json({ error: 'Failed to read tags from converted MP3' });
    }

    mp3tag.frames = [];

    const imageData = await fetchImage(formatted_song_info.cover);
    console.log(formatted_song_info.cover)
    mp3tag.frames.push({
      id: 'APIC',
      value: {
        format: 'image/jpeg',
        type: 3,
        description: 'Cover',
        data: imageData
      }
    });
    
    mp3tag.tags.title = formatted_song_info.title;
    mp3tag.tags.artist = formatted_song_info.artist;
    mp3tag.tags.album = formatted_song_info.album;
    mp3tag.tags.genre = formatted_song_info.genres;
    mp3tag.tags.track = String(formatted_song_info.track_no);
    mp3tag.tags.year = formatted_song_info.release_date;

    mp3tag.save({ id3v2: { include: true, version: 4 } });

    // Return the finalized MP3
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': `attachment; filename="${formatted_song_info.artist} - ${formatted_song_info.title}.mp3"`,
    });
    res.send(Buffer.from(mp3tag.buffer));

  } catch (err) {
    console.error('Error processing file:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;