import axios from 'axios';
import { TextField, Button, Box, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

// Function to send the PUT request to the backend
const editRecord = async (data: { key: number; newValue: string }) => {
  const response = await axios.put('http://localhost:4001/api/edit', {
    key: data.key,
    newValue: data.newValue,
  });
  return response.data; // Ensure the message is included in the response
};

const EditForm = () => {
  const [formData, setFormData] = useState({ key: 0, newValue: "" });
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const mutation = useMutation({
    mutationFn: (data: { key: number; newValue: string }) => editRecord(data),
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
    onSuccess: (data) => {
      console.log("Response from server:", data); 
      setErrorMessage("");
      setSuccessMessage(data.message || "Record edited successfully!");
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
        Edit Record to B-Tree
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
        name="newValue"
        type="text"
        value={formData.newValue}
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
        {mutation.isPending ? "Editing..." : "Edit Record"}
      </Button>

      {errorMessage && <Typography color="error">{errorMessage}</Typography>}

      {mutation.isError && !errorMessage && (
        <Typography color="error">Error editing record.</Typography>
      )}

      {mutation.isSuccess && successMessage && (
        <Typography color="primary">{successMessage}</Typography>
      )}

     </Box>
  );
};

export default EditForm;
