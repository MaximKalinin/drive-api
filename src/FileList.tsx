import { useEffect, useCallback, useState } from 'react';
import download from 'js-file-download';

import {ROOT_FOLDER_MIME, FileType} from './App';

function FileRow({file}: {file: FileType})
{
    const {ids, name} = file;

    const [loading, set_loading] = useState(false);

    const on_file_download = useCallback(async () => 
    {
        const token = gapi.auth.getToken().access_token;

        set_loading(true);

        try
        {
            const result: Blob[] = await Promise.all(ids.map(id => fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
                headers: {
                    'Authorization': 'Bearer ' + token
                },
            }).then(response => response.blob())));
    
            console.log(result);
    
            const file_to_download = new Blob(result, {type: result[0].type});
    
            console.log(file_to_download);
    
            download(file_to_download, name);

            set_loading(false);
        }
        catch(error)
        {
            console.error(error);
            
            set_loading(false);
        }
    }, [ids, name]);

    return (<div key={ids[0]}><div>{name}</div><button disabled={loading} onClick={on_file_download}>download file</button>{loading && <span>loading...</span>}</div>);
}

export function FileList({root_folder_id, files, set_files}: {root_folder_id: string; files: FileType[]; set_files: (files: FileType[]) => void})
{
    useEffect(() => 
    {
        (async () => 
        {
            const new_files: FileType[] = [];
            const response: {result: {files: {id: string; name: string}[]}} = await (gapi.client as any).drive.files.list({
                fields: 'nextPageToken, files(id, name)',
                q: `mimeType != '${ROOT_FOLDER_MIME}' and '${root_folder_id}' in parents and trashed = false`
            });
              
            response.result.files.forEach(file => 
            {
                if(!file.name.startsWith('['))
                    return;

                let chunk_index: number | string | undefined = file.name.match(/^\[([0-9]+)\]/)?.[1];

                if(!chunk_index)
                    return;

                chunk_index = parseInt(chunk_index);

                const index = new_files.findIndex(({name}) => file.name.replace(/^\[[0-9]+\]/, '') === name.replace(/^\[[0-9]+\]/, ''));

                if(index > -1)
                    new_files[index].ids[chunk_index] = file.id;
                else
                {
                    const ids: string[] = [];
                    ids[chunk_index] = file.id;
                    new_files.push({ids, name: file.name.replace(/^\[[0-9]+\]/, '')});
                }
            });

            set_files(new_files);
        })();
    }, []);

    return <div>
        {files.map((file) => <FileRow key={file.ids[0]} file={file} />)}
    </div>;
}