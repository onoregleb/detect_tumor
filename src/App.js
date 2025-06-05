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

// New component for displaying image with bounding boxes
const ImageWithBoundingBox = ({ imagePath, detections }) => {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  const handleImageLoad = (event) => {
    setImageSize({
      width: event.target.naturalWidth,
      height: event.target.naturalHeight
    });
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <img
        src={`file://${imagePath}`}
        alt="Scan"
        style={{ width: '100%', height: 'auto' }}
        onLoad={handleImageLoad}
      />
      {detections && detections.map((detection, index) => {
        const [x1, y1, x2, y2] = detection.bbox;
        const width = imageSize.width;
        const height = imageSize.height;
        
        const boxStyle = {
          position: 'absolute',
          left: `${(x1 / width) * 100}%`,
          top: `${(y1 / height) * 100}%`,
          width: `${((x2 - x1) / width) * 100}%`,
          height: `${((y2 - y1) / height) * 100}%`,
          border: '2px solid red',
          boxSizing: 'border-box',
        };

        return <Box key={index} sx={boxStyle} />;
      })}
    </Box>
  );
};

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
          Обнаружение Опухоли Головного Мозга
        </Typography>
        <Typography variant="subtitle1" gutterBottom align="center" color="text.secondary">
          Загрузите изображения МРТ/КТ для обнаружения потенциальных опухолей головного мозга
        </Typography>
      </Paper>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} centered>
          <Tab label="Пакетная Обработка" />
          <Tab label="Одиночное Изображение" />
        </Tabs>
      </Box>

      {activeTab === 0 ? (
        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 3, height: '100%' }}>
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Загрузка Изображений
                </Typography>
                <Button
                  variant="contained"
                  component="label"
                  startIcon={<CloudUploadIcon />}
                  fullWidth
                  onClick={handleFileSelect}
                >
                  Выбрать Изображения МРТ/КТ
                </Button>
                {selectedFiles.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" gutterBottom>
                      Выбрано файлов: {selectedFiles.length}
                    </Typography>
                    <Grid container spacing={2}>
                      {selectedFiles.map((file, index) => (
                        <Grid item xs={12} key={index}>
                          <Card>
                            <CardMedia
                              component="img"
                              height="200"
                              image={`file://${file}`}
                              alt={`Загруженное изображение ${index + 1}`}
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
                {loading ? <CircularProgress size={24} /> : 'Обнаружить Опухоли'}
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
                Результаты Обнаружения
              </Typography>
              {results.length > 0 ? (
                <>
                  <Box sx={{ mb: 2 }}>
                    <Button
                      variant="outlined"
                      startIcon={<SaveIcon />}
                      onClick={handleSaveResults}
                    >
                      Сохранить Результаты
                    </Button>
                  </Box>
                  <Grid container spacing={2}>
                    {results.map((result, index) => (
                      <Grid item xs={12} key={index}>
                        <Card>
                          <Box sx={{ position: 'relative' }}>
                            <ImageWithBoundingBox
                              imagePath={result.path}
                              detections={result.detections}
                            />
                          </Box>
                          <CardContent>
                            <Typography variant="h6" color={result.hasTumor ? 'error' : 'success'}>
                              {result.hasTumor ? 'Обнаружена Опухоль' : 'Опухоль Не Обнаружена'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Уверенность: {result.confidence.toFixed(2)}%
                            </Typography>
                            {result.detections && result.detections.length > 0 && (
                              <Box sx={{ mt: 1 }}>
                                <Typography variant="body2">
                                  Обнаружено опухолей: {result.detections.length}
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
                  Нет результатов. Загрузите изображения и запустите обнаружение, чтобы увидеть результаты.
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