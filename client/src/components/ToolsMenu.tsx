import React, { useState } from 'react';
import { Tabs, Tab, Box } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import AddForm from './AddForm';
import DeleteForm from './DeleteForm';
import EditForm from './EditForm';
import SearchForm from './SearchForm';

export default function ToolsMenu() {
  const [value, setValue] = useState(0);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (  
    <Box sx={{
      mt: "40px",
      mx: '20px'
    }}>
      <Tabs 
        value={value} 
        onChange={handleChange} 
        indicatorColor="primary" 
        textColor="primary">  
        <Tab icon={<AddIcon />} />
        <Tab icon={<DeleteIcon />} />
        <Tab icon={<EditIcon />} />
        <Tab icon={<SearchIcon />} />
      </Tabs>

      <div>
        {value === 0 && <AddForm />}
        {value === 1 && <DeleteForm />}
        {value === 2 && <EditForm />}
        {value === 3 && <SearchForm />}
      </div>
    </Box>
  );
}
