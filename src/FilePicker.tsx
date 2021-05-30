import {useCallback, ChangeEvent, useState} from 'react';
import { FileType } from './App';

export function FilePicker({root_folder_id, add_files}: {root_folder_id: string; add_files: (files: FileType[]) => void})
{
    const [file, set_file] = useState<File | null>(null);
    const [loading, set_loading] = useState(false);
    const on_file = useCallback((event: ChangeEvent<HTMLInputElement>) => 
    {
        if(event.target.files && event.target.files.length)
            set_file(event.target.files.item(0));
    }, []);

    const split_file = useCallback(async () => 
    {
        if(!file)
            return;

        set_loading(true);

        const chunkSize = 1024 * 1024;
        const fileSize = file.size;
        const chunks = Math.ceil(file.size / chunkSize) - 1;
        const slices: Blob[] = [];
        let chunk = 0;

        console.log('file size..', fileSize);
        console.log('chunks...', chunks);

        while (chunk <= chunks) 
        {
            const offset = chunk * chunkSize;
            console.log(file.slice(offset, offset + chunkSize, file.type));
            slices.push(file.slice(offset, offset + chunkSize, file.type));
            chunk++;
        }

        console.log('total chunk size', slices.reduce((total, {size}) => total + size, 0));

        const token = gapi.auth.getToken().access_token;

        try
        {
            const response: {id: string; name: string}[] = await Promise.all(slices.map((slice, index) => fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=media', {
                    method: 'POST',
                    headers: {
                        'Content-type': 'application/octet-stream',
                        'Authorization': 'Bearer ' + token
                    },
                    body: slice
                })
                    .then(async response => response.json())
                    .then((response: {id: string}) => fetch(`https://www.googleapis.com/drive/v3/files/${response.id}?addParents=${root_folder_id}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-type': 'application/json',
                            'Authorization': 'Bearer ' + token
                        },
                        body: JSON.stringify({
                            name: `[${index}]${file.name}`
                        })
                    }))
                    .then(async response => response.json()))
            );
            
            add_files(response.reduce((output, slice) => 
            {
                if(!slice.name.startsWith('['))
                    return output;
                
                let chunk_index: number | string | undefined = slice.name.match(/^\[([0-9]+)\]/)?.[1];
                
                if(!chunk_index)
                    return output;

                chunk_index = parseInt(chunk_index);

                const index = output.findIndex(({name}) => slice.name.replace(/^\[[0-9]+\]/, '') === name.replace(/^\[[0-9]+\]/, ''));

                if(index > -1)
                    output[index].ids[chunk_index] = slice.id;
                else
                {
                    const ids: string[] = [];
                    ids[chunk_index] = slice.id;
                    output.push({ids, name: slice.name.replace(/^\[[0-9]+\]/, '')});
                }

                return output;
            }, [] as FileType[]));
            
            set_loading(false);
        }
        catch(error)
        {
            console.error(error);
            
            set_loading(false);
        }
    }, [file, root_folder_id, add_files]);

    return <>
        <input type='file' onChange={on_file} />
        {file && <button onClick={split_file} disabled={loading}>Upload file</button>}
        {loading && <span>uploading...</span>}
    </>;
}