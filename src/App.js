import React, { useState } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Grid,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  CardMedia,
  Tabs,
  Tab,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SearchIcon from '@mui/icons-material/Search';
import SaveIcon from '@mui/icons-material/Save';
import TumorDetector from './components/TumorDetector';

const { ipcRenderer } = window.require('electron');

const Input = styled('input')({
  display: 'none',
});

const App = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleFileSelect = async () => {
    try {
      const filePaths = await ipcRenderer.invoke('select-files');
      if (filePaths && filePaths.length > 0) {
        setSelectedFiles(filePaths);
        setError(null);
      }
    } catch (err) {
      setError('Error selecting files');
    }
  };

  const handleDetect = async () => {
    setLoading(true);
    setError(null);
    try {
      const detectionResults = await Promise.all(
        selectedFiles.map(async (file) => {
          const result = await ipcRenderer.invoke('detect-tumor', file);
          return {
            path: file,
            hasTumor: result.has_tumor,
            confidence: result.confidence * 100,
            detections: result.detections
          };
        })
      );
      setResults(detectionResults);
    } catch (err) {
      setError('Error during detection: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveResults = async () => {
    try {
      await ipcRenderer.invoke('save-results', results);
    } catch (err) {
      setError('Error saving results');
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Brain Tumor Detection
        </Typography>
        <Typography variant="subtitle1" gutterBottom align="center" color="text.secondary">
          Upload MRI/CT scan images to detect potential brain tumors
        </Typography>
      </Paper>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} centered>
          <Tab label="Batch Processing" />
          <Tab label="Single Image" />
        </Tabs>
      </Box>

      {activeTab === 0 ? (
        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 3, height: '100%' }}>
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Upload Images
                </Typography>
                <Button
                  variant="contained"
                  component="label"
                  startIcon={<CloudUploadIcon />}
                  fullWidth
                  onClick={handleFileSelect}
                >
                  Select MRI/CT Images
                </Button>
                {selectedFiles.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" gutterBottom>
                      {selectedFiles.length} file(s) selected
                    </Typography>
                    <Grid container spacing={2}>
                      {selectedFiles.map((file, index) => (
                        <Grid item xs={12} key={index}>
                          <Card>
                            <CardMedia
                              component="img"
                              height="200"
                              image={`file://${file}`}
                              alt={`Uploaded scan ${index + 1}`}
                              sx={{ objectFit: 'contain' }}
                            />
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                )}
              </Box>

              <Button
                variant="contained"
                color="primary"
                startIcon={<SearchIcon />}
                fullWidth
                onClick={handleDetect}
                disabled={selectedFiles.length === 0 || loading}
                sx={{ mb: 2 }}
              >
                {loading ? <CircularProgress size={24} /> : 'Detect Tumors'}
              </Button>

              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Detection Results
              </Typography>
              {results.length > 0 ? (
                <>
                  <Box sx={{ mb: 2 }}>
                    <Button
                      variant="outlined"
                      startIcon={<SaveIcon />}
                      onClick={handleSaveResults}
                    >
                      Save Results
                    </Button>
                  </Box>
                  <Grid container spacing={2}>
                    {results.map((result, index) => (
                      <Grid item xs={12} key={index}>
                        <Card>
                          <CardMedia
                            component="img"
                            height="200"
                            image={`file://${result.path}`}
                            alt={`Scan ${index + 1}`}
                            sx={{ objectFit: 'contain' }}
                          />
                          <CardContent>
                            <Typography variant="h6" color={result.hasTumor ? 'error' : 'success'}>
                              {result.hasTumor ? 'Tumor Detected' : 'No Tumor Detected'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Confidence: {result.confidence.toFixed(2)}%
                            </Typography>
                            {result.detections && result.detections.length > 0 && (
                              <Box sx={{ mt: 1 }}>
                                <Typography variant="body2">
                                  Detected {result.detections.length} tumor(s)
                                </Typography>
                              </Box>
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </>
              ) : (
                <Typography variant="body1" color="text.secondary" align="center">
                  No results yet. Upload images and run detection to see results.
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      ) : (
        <Paper elevation={3} sx={{ p: 3 }}>
          <TumorDetector />
        </Paper>
      )}
    </Container>
  );
};

export default App; 