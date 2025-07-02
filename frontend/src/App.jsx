import { useState } from 'react'
import './App.css'

function App() {
  const [fileSelected, setFileSelected] = useState(false);
  const [fileName, setFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

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

  const uploadFile = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile, selectedFile.name);

    try {
      const res = await fetch('https://mp3-metadata-finder-api.vercel.app/api/process-mp3', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to upload');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = selectedFile.name;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  return (
    <div className='h-screen flex flex-col justify-between items-center p-5 lg:p-10'>
      <div>
        <h1 className='font-extrabold text-6xl'>Mp3 Metadata Finder</h1>
      </div>

      <div>
        <form
          onSubmit={(e) => {
            console.log("File is being submitted...")
            e.preventDefault(); // prevent page reload
            uploadFile();
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
              id="uploadBtn"
              className='duration-300 ease-in border-blue-600 border-2 rounded-sm text-blue-600 hover:cursor-pointer p-2 lg:py-2 lg:px-8 hover:bg-blue-600 hover:text-white hover:ease-out hover:duration-300'
            >
              Download
            </button>
          )}
        </form>
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