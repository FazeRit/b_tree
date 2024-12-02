import axios from 'axios';
import { TextField, Button, Box, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

const deleteRecord = async (data: { key: number; }) => {
  const response = await axios.delete('http://localhost:4001/api/delete', {
    data: { key: data.key },
  });
  return response.data;
};

const DeleteForm = () => {
  const [formData, setFormData] = useState({ key: 0 });
  const [errorMessage, setErrorMessage] = useState("");  // Додаємо стан для помилки

  const mutation = useMutation({
    mutationFn: (data: { key: number; }) => deleteRecord(data),
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
        Delete Record from B-Tree
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

      <Button
        type="submit"
        variant="contained"
        color="primary"
        fullWidth
        disabled={mutation.isPending}
      >
        {mutation.isPending ? "Deleting..." : "Delete Record"}
      </Button>

      {errorMessage && <Typography color="error">{errorMessage}</Typography>}

      {mutation.isError && !errorMessage && (
        <Typography color="error">Error deleting record.</Typography>
      )}
      {mutation.isSuccess && <Typography color="primary">Record deleted successfully!</Typography>}
    </Box>
  );
};

export default DeleteForm;
