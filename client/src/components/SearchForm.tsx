import axios from 'axios';
import { TextField, Button, Box, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

const searchRecord = async (data: { key: number }) => {
  const response = await axios.post(
    'http://localhost:4001/api/search',
    { key: data.key },
    { withCredentials: true }
  );
  return response.data; 
};

const SearchForm = () => {
  const [formData, setFormData] = useState({ key: 0 });
  const [errorMessage, setErrorMessage] = useState('');
  const [foundRecord, setFoundRecord] = useState<any>(null);
  const [comparisons, setComparisons] = useState<number | null>(null);

  const mutation = useMutation({
    mutationFn: (data: { key: number }) => searchRecord(data),
    onError: (error: any) => {
      setFoundRecord(null);
      setComparisons(null);
      if (error.response && error.response.data) {
        const { errors, message } = error.response.data;
        if (errors && errors.length > 0) {
          const keyError = errors.find((err: { path: string }) => err.path === 'key');
          if (keyError) {
            setErrorMessage(keyError.msg);
          } else {
            setErrorMessage('An unexpected error occurred.');
          }
        } else if (message) {
          setErrorMessage(message);
        } else {
          setErrorMessage('An unexpected error occurred.');
        }
      } else {
        setErrorMessage('An unexpected error occurred.');
      }
    },
    onSuccess: (data: { message: string; record: any; comparisons: number }) => {
      setErrorMessage('');
      setFoundRecord(data.record);
      setComparisons(data.comparisons);
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: Number(value) }));
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
        Search Record in B-Tree
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
        {mutation.isPending ? 'Searching...' : 'Search Record'}
      </Button>

      {errorMessage && <Typography color="error">{errorMessage}</Typography>}

      {mutation.isError && !errorMessage && (
        <Typography color="error">Error searching record.</Typography>
      )}

      {mutation.isSuccess && (
        <>
          <Typography color="primary" gutterBottom>
            {mutation.data.message}
          </Typography>
          {foundRecord && (
            <Box sx={{ bgcolor: 'background.paper', p: 2, borderRadius: 1 }}>
              <Typography variant="body1">
                <strong>Record Details:</strong>
              </Typography>
              <Typography variant="body2">Key: {foundRecord.key}</Typography>
              <Typography variant="body2">Value: {foundRecord.value}</Typography>
            </Box>
          )}
          {comparisons !== null  && foundRecord && (
            <Typography variant="body2" gutterBottom>
              <strong>Comparisons:</strong> {comparisons}
            </Typography>
          )}
        </>
      )}
    </Box>
  );
};

export default SearchForm;
