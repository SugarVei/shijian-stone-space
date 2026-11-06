import {layoutStones} from './layout';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,cells:layoutStones(data.items,data.width,data.height)});}catch(error){self.postMessage({id:data.id,error:error.message});}};
