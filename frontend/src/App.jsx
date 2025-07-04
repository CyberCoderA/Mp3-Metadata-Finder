import { useEffect, useState } from 'react';
import axios from 'axios';
import MP3Tag from 'mp3tag.js';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import './App.css';

function App() {
  const [progress, setProgress] = useState(0);
  const [fileSelected, setFileSelected] = useState(false);
  const [fileName, setFileName] = useState('');
  const [metadata, setMetadata] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    const fetchMetadata = async () => {
      if (!selectedFile) return;

      try {
        const res = await axios.post('https://mp3-metadata-finder-api.onrender.com/api/retrieve-mp3-data',{file_name: fileName});
        setMetadata(res.data)
      } catch (err) {
        console.error('Upload failed:', err);
      }
    };

    fetchMetadata();
  }, [selectedFile]);

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileName(file.name);
      setSelectedFile(file);
      setFileSelected(true);
    } else {
      setFileName('');
      setSelectedFile(null);
      setFileSelected(false);
    }
  };

  const handleConversionProcess = async () => {
    try {
      setProgress(10);
      const ffmpeg = new FFmpeg();

      setProgress(20);
      await ffmpeg.load();

      setProgress(30);
      await ffmpeg.writeFile(selectedFile.name, await fetchFile(selectedFile));

      setProgress(50);
      await ffmpeg.exec([
        '-i', selectedFile.name,
        '-vn', '-ar', '44100', '-ac', '2', '-b:a', '192k',
        'output.mp3'
      ]);

      setProgress(65);
      const data = await ffmpeg.readFile('output.mp3');
      const mp3Blob = new Blob([data.buffer], { type: 'audio/mpeg' });
      const arrayBuffer = await mp3Blob.arrayBuffer();
      const mp3tag = new MP3Tag(arrayBuffer);
      mp3tag.read();

      setProgress(75); // Setting the audio metadata
      const imageData = await fetchImage(metadata.data.cover);

      mp3tag.frames = [];
      mp3tag.frames.push({
        id: 'APIC',
        value: {
          format: 'image/jpeg',
          type: 3,
          description: 'Cover',
          data: imageData
        }
      });

      mp3tag.tags.title = metadata.data.title;
      mp3tag.tags.artist = metadata.data.artist;
      mp3tag.tags.album = metadata.data.album;
      mp3tag.tags.genre = metadata.data.genres;
      mp3tag.tags.track = String(metadata.data.track_no);
      mp3tag.tags.year = metadata.data.release_date;

      mp3tag.save({ id3v2: { include: true, version: 4 } });

      setProgress(90); // Creating a downloadable file with the metadata embeded
      const downloadableBlob = new Blob([mp3tag.buffer], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(downloadableBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();

      // Clean up object URL
      URL.revokeObjectURL(url);
      setProgress(100);
    } catch (err) {
      console.error('Download failed:', err);
      setProgress(0); // Restart progress to 0 when it failed.
    }
  }

  const fetchFile = async (file) => {
    const response = await fetch(URL.createObjectURL(file));
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  };

  async function fetchImage(imageUrl) {
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  return (
    <div className='h-screen flex flex-col justify-between items-center p-5 lg:p-10'>
      <div>
        <h1 className='font-extrabold text-6xl'>Mp3 Metadata Finder</h1>
      </div>

      <div>
        <form
          onSubmit={(e) => {
            console.log("File is being downloaded...")
            e.preventDefault(); // prevent page reload
            handleConversionProcess();
          }}
          encType="multipart/form-data"
          className='flex gap-5 lg:flex-col items-center'
        >
          <label className="block mr-3">
            <input
              type="file"
              onChange={handleChange}
              className="hidden"
              id="fileUpload"
            />
            <label
              htmlFor="fileUpload"
              className="cursor-pointer bg-gray-200 border-3 border-dashed p-2 lg:px-25 lg:py-25 rounded lg:text-2xl hover:bg-gray-300"
            >
              {fileName ? fileName : '+ Select a file'}
            </label>
          </label>

          {fileSelected && (
            <button
              type="submit"
              id="convertBtn"
              className='duration-300 ease-in border-blue-600 border-2 rounded-sm text-blue-600 hover:cursor-pointer p-2 lg:py-2 lg:px-8 hover:bg-blue-600 hover:text-white hover:ease-out hover:duration-300'
            >
              Convert
            </button>
          )}
        </form>

        {progress > 0 && (
          <div className="w-full mt-20">
            <div className="w-full bg-gray-300 rounded-full h-4">
              <div
                className="bg-blue-600 h-4 rounded-full"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm text-center mt-1">{progress}%</p>
          </div>
        )}
      </div>

      <div>
        <h2 className='font-bold text-2xl'>
          Note: When uploading the audio file, make sure it's named in this format. ([Artist name] - [Song title])
        </h2>
      </div>
    </div>
  );
}

export default App;