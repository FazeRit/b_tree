import axios from 'axios';
import { TextField, Button, Box, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

const addRecord = async (data: { key: number; value: string }) => {
  const response = await axios.post('http://localhost:4001/api/add', 
    { key: data.key, value: data.value }, 
    { 
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' },
    });
  return response.data;
};

const AddForm = () => {
  const [formData, setFormData] = useState({ key: 0, value: '' });
  const [errorMessage, setErrorMessage] = useState("");

  const mutation = useMutation({
    mutationFn: (data: { key: number; value: string }) => addRecord(data),
    onError: (error: any) => {
      if (error.response && error.response.data) {
        const { errors, message } = error.response.data;
        if (errors && errors.length > 0) {
          const keyError = errors.find((err: { path: string }) => err.path === 'key');
          if (keyError) {
            setErrorMessage(keyError.msg); 
          } else {
            setErrorMessage("An unexpected error occurred.");
          }
        } else if (message) {
          setErrorMessage(message);
        } else {
          setErrorMessage("An unexpected error occurred.");
        }
      } else {
        setErrorMessage("An unexpected error occurred.");
      }
    },
    onSuccess: () => {
      setErrorMessage("");
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "key" ? parseInt(value, 10) : value, 
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        color: 'text.primary',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        maxWidth: 400,
        margin: 'auto',
        mt: 4,
      }}
    >
      <Typography variant="h5" component="h1" gutterBottom>
        Add Record to B-Tree
      </Typography>

      <TextField
        label="Key"
        name="key"
        type="number"
        value={formData.key}
        onChange={handleChange}
        required
        fullWidth
      />

      <TextField
        label="Value"
        name="value"
        type="text"
        value={formData.value}
        onChange={handleChange}
        required
        fullWidth
      />

      <Button
        type="submit"
        variant="contained"
        color="primary"
        fullWidth
        disabled={mutation.isPending}
      >
        {mutation.isPending ? "Adding..." : "Add Record"}
      </Button>

      {errorMessage && <Typography color="error">{errorMessage}</Typography>}

      {mutation.isError && !errorMessage && (
        <Typography color="error">Error adding record.</Typography>
      )}
      {mutation.isSuccess && <Typography color="primary">Record added successfully!</Typography>}
    </Box>
  );
};

export default AddForm;
