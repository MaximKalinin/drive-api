import { useCallback, useEffect, useState } from 'react';
import './App.css';
import { FilePicker } from './FilePicker';
import { FileList } from './FileList';

const CLIENT_ID = process.env.REACT_APP_CLIENT_ID;
const API_KEY = process.env.REACT_APP_API_KEY;

const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];

const SCOPES = 'https://www.googleapis.com/auth/drive';

export const ROOT_FOLDER_NAME = 'sync app';
export const ROOT_FOLDER_MIME = 'application/vnd.google-apps.folder';

export interface FileType
{
    ids: string[];
    name: string;
}

function App() {

  const [loaded, set_loaded] = useState(false);
  const [signed, set_signed] = useState(false);
  const [root_folder_id, set_root_folder_id] = useState('');
  const [files, set_files] = useState<FileType[]>([]);

  useEffect(() => 
  {
    gapi.load('client:auth2', () => 
    {
      console.log('gapi loaded');

      gapi.client.init({
        apiKey: API_KEY,
        clientId: CLIENT_ID,
        discoveryDocs: DISCOVERY_DOCS,
        scope: SCOPES
      }).then(() => 
      {    
        console.log('gapi inited');
        set_loaded(true);
        (gapi as any).auth2.getAuthInstance().isSignedIn.listen(set_signed);
    
        set_signed((gapi as any).auth2.getAuthInstance().isSignedIn.get());
      });
    });
  }, []);

  useEffect(() => 
  {
    if(!signed)
      return;

    (gapi.client as any).drive.files.list({
      pageSize: 1,
      fields: 'files(id)',
      q: `mimeType = '${ROOT_FOLDER_MIME}' and name = '${ROOT_FOLDER_NAME}' and 'root' in parents and trashed = false`
    }).then(function(response: {result: {files: {id: string; name: string}[]}}) 
    {
      if(response.result.files.length)
        set_root_folder_id(response.result.files[0].id);
    });    
  }, [signed]);

  const initialize_root = useCallback(() => 
  {
    (gapi.client as any).drive.files.create({
      resource: {
        name: ROOT_FOLDER_NAME,
        mimeType: ROOT_FOLDER_MIME
      },
      fields: 'id'
    }).then((response: {result: {id: string}}) => 
    {
      set_root_folder_id(response.result.id);
    });
  }, []);

  const signout = useCallback(() => 
  {
    (gapi as any).auth2?.getAuthInstance()?.signOut();
    set_root_folder_id('');
    console.log('set root to \'\'');
  }, []);

  const add_files = useCallback((new_files: FileType[]) => 
  {
    set_files(old_files => [...old_files, ...new_files])
  }, []);

  return (
    <div className="App">
      {loaded && <>
        {signed ? <button 
            onClick={signout}
          >
            signout from google
          </button> : <button 
            onClick={(gapi as any).auth2?.getAuthInstance()?.signIn}
          >
            signin to google
          </button>}
        </>}
      {signed && !root_folder_id && <button onClick={initialize_root}>Create '{ROOT_FOLDER_NAME}' folder in your root Google Drive and initialize the app</button>}
      {root_folder_id && <FilePicker root_folder_id={root_folder_id} add_files={add_files} />}
      {root_folder_id && <FileList files={files} set_files={set_files} root_folder_id={root_folder_id} />}
    </div>
  );
}

export default App;
