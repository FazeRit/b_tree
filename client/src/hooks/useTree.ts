import axios from 'axios';
import { useQuery } from "@tanstack/react-query"

const fetchTree = async () =>{
    const response = await axios
        .get('http://localhost:4001/api/',)

    return response.data;
}


const useTree = () =>{
    return useQuery({
        queryKey: ['tree'],
        queryFn: fetchTree
    })
}

export { useTree, fetchTree};