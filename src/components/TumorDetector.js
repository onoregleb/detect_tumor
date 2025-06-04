import React, { useState } from 'react';
import './TumorDetector.css';

const TumorDetector = () => {
    const [selectedImage, setSelectedImage] = useState(null);
    const [detectionResult, setDetectionResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleImageUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setSelectedImage(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDetection = async () => {
        if (!selectedImage) {
            setError('Пожалуйста, загрузите изображение');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch('http://localhost:5000/api/detect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ image: selectedImage }),
            });

            const data = await response.json();
            
            if (response.ok) {
                setDetectionResult(data);
            } else {
                setError(data.error || 'Произошла ошибка при обработке изображения');
            }
        } catch (err) {
            setError('Ошибка при отправке запроса на сервер');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="tumor-detector">
            <h2>Детекция опухолей головного мозга</h2>
            
            <div className="upload-section">
                <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="file-input"
                />
                {selectedImage && (
                    <div className="image-preview">
                        <img src={selectedImage} alt="Preview" />
                    </div>
                )}
            </div>

            <button 
                onClick={handleDetection}
                disabled={!selectedImage || loading}
                className="detect-button"
            >
                {loading ? 'Обработка...' : 'Определить опухоль'}
            </button>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            {detectionResult && (
                <div className="result-section">
                    <h3>Результаты анализа:</h3>
                    <p>Наличие опухоли: {detectionResult.has_tumor ? 'Обнаружена' : 'Не обнаружена'}</p>
                    {detectionResult.has_tumor && (
                        <div>
                            <p>Уверенность: {(detectionResult.confidence * 100).toFixed(2)}%</p>
                            <div className="detections">
                                {detectionResult.detections.map((detection, index) => (
                                    <div key={index} className="detection-item">
                                        <p>Обнаружение #{index + 1}</p>
                                        <p>Уверенность: {(detection.confidence * 100).toFixed(2)}%</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TumorDetector; 