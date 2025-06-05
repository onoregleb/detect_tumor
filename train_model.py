import os
import yaml
import shutil
import requests
from ultralytics import YOLO
from pathlib import Path

def download_dataset():
    """Скачивает и распаковывает датасет"""
    print("Скачивание датасета...")
    
    # Создаем папку для датасета
    os.makedirs('datasets', exist_ok=True)
    
    # URL датасета из конфигурации
    dataset_url = "https://github.com/ultralytics/assets/releases/download/v0.0.0/brain-tumor.zip"
    
    # Скачиваем датасет
    response = requests.get(dataset_url)
    if response.status_code == 200:
        with open('datasets/brain-tumor.zip', 'wb') as f:
            f.write(response.content)
        print("Датасет успешно скачан")
        
        # Распаковываем архив
        import zipfile
        with zipfile.ZipFile('datasets/brain-tumor.zip', 'r') as zip_ref:
            zip_ref.extractall('datasets')
        print("Датасет распакован")
        
        # Удаляем zip файл
        os.remove('datasets/brain-tumor.zip')
    else:
        raise Exception("Не удалось скачать датасет")

def prepare_dataset():
    """Подготавливает датасет для обучения"""
    print("Подготовка датасета...")
    
    # Проверяем структуру датасета
    dataset_path = Path('datasets')
    if not dataset_path.exists():
        raise Exception("Папка с датасетом не найдена")
    
    # Проверяем наличие необходимых подпапок
    train_path = dataset_path / 'train'
    val_path = dataset_path / 'valid'
    
    if not train_path.exists() or not val_path.exists():
        raise Exception("Неправильная структура датасета")
    
    # Создаем конфигурационный файл для YOLO
    yaml_config = {
        'path': str(dataset_path.absolute()),  # путь к корневой папке датасета
        'train': 'train/images',  # путь к тренировочным изображениям
        'val': 'valid/images',    # путь к валидационным изображениям
        'names': {
            0: 'negative',  # нет опухоли
            1: 'positive'   # есть опухоль
        }
    }
    
    # Сохраняем конфигурацию
    with open('brain-tumor.yaml', 'w') as f:
        yaml.dump(yaml_config, f, default_flow_style=False)
    
    print("Датасет готов к использованию")

def train_model():
    """Обучает модель YOLOv8"""
    print("Начало обучения модели...")
    
    # Загружаем базовую модель
    model = YOLO('yolov8n.pt')
    
    # Параметры обучения
    training_args = {
        'data': 'brain-tumor.yaml',  # путь к конфигурации датасета
        'epochs': 100,               # количество эпох
        'imgsz': 640,               # размер изображения
        'batch': 16,                # размер батча
        'patience': 50,             # ранняя остановка
        'device': '0' if os.environ.get('CUDA_VISIBLE_DEVICES') else 'cpu',  # использование GPU если доступно
        'workers': 8,               # количество воркеров
        'project': 'runs/train',    # папка для сохранения результатов
        'name': 'brain_tumor',      # имя эксперимента
        'exist_ok': True,           # перезаписывать существующие результаты
        'pretrained': True,         # использовать предобученные веса
        'optimizer': 'auto',        # автоматический выбор оптимизатора
        'verbose': True,            # подробный вывод
        'seed': 42,                 # фиксированный seed для воспроизводимости
    }
    
    # Начинаем обучение
    results = model.train(**training_args)
    
    # Сохраняем обученную модель
    model_path = 'models/brain_tumor.pt'
    os.makedirs('models', exist_ok=True)
    model.save(model_path)
    
    print(f"Модель обучена и сохранена в {model_path}")
    return results

def main():
    try:
        # Скачиваем датасет
        download_dataset()
        
        # Подготавливаем датасет
        prepare_dataset()
        
        # Обучаем модель
        results = train_model()
        
        print("\nОбучение завершено успешно!")
        print(f"Результаты сохранены в папке: runs/train/brain_tumor")
        
    except Exception as e:
        print(f"Произошла ошибка: {str(e)}")

if __name__ == '__main__':
    main() 