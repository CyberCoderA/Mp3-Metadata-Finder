const express = require('express');
const axios = require('axios');
// const MP3Tag = require('mp3tag.js');
// const { Readable } = require('stream');
// const { WritableStreamBuffer } = require('stream-buffers');
// const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
// const ffmpeg = require('fluent-ffmpeg');

// ffmpeg.setFfmpegPath(ffmpegPath);

const router = express.Router();

// Helper: convert buffer to readable stream
// function bufferToStream(buffer) {
//   const stream = new Readable();
//   stream.push(buffer);
//   stream.push(null);
//   return stream;
// }

router.get('/status', async(req, res) => {
  res.send({message: "API is currently running!"});
})

router.post('/retrieve-mp3-data', async (req, res) => {
  try {
    const file_name = req.body.file_name;
    if (!file_name) return res.status(400).json({ message: 'No file uploaded' });

    // Extract artist & song from filename
    const base_song_info = file_name.replace('.mp3', '').split('-');

    // Check if the split string followed the format
    if (base_song_info.length < 2) {
      return res.status(400).json({ message: 'Filename must be in format "Artist - Title.mp3"' });
    }

    const base_artist = base_song_info[0].trim();
    const base_song = base_song_info[1].trim();

    // Get song metadata
    const song_info = await axios.get(`https://api.deezer.com/search?q=artist:"${base_artist}" track:"${base_song}"`);
    if (!song_info.data.data.length) return res.status(404).json({ message: 'Song not found in Deezer' })
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
    
    res.status(200).json({message: "Success!", data: formatted_song_info});

  } catch (err) {
    console.error('Error processing file:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;