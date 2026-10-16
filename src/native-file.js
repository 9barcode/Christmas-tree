import {File} from '@apps-in-toss/web-framework';

export function saveNativePhoto(data){
 return File.saveBase64({data,fileName:'my-christmas-tree.png',mimeType:'image/png'});
}
