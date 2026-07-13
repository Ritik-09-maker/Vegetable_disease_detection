# 🥬 Vegetable Disease Classification Using Deep Learning

## 📌 Overview

Vegetable Disease Classification is an Artificial Intelligence and Deep Learning project designed to identify diseases in vegetable leaves from images. The system helps farmers, researchers, and agriculture professionals detect plant diseases at an early stage, enabling timely treatment and reducing crop losses.

The model uses **Convolutional Neural Networks (CNNs)** with **Transfer Learning (MobileNetV2)** to classify diseases accurately from uploaded images.

---

# 🚀 Features

* 🌱 Detect diseases from vegetable leaf images
* 🤖 Deep Learning-based image classification
* 📷 Upload images for prediction
* ⚡ Fast and accurate inference
* 📊 Confidence score for each prediction
* 💻 User-friendly interface
* 📱 Can be deployed as a web application
* 🌾 Supports multiple vegetable classes

---

# 🧠 Technologies Used

### Programming Language

* Python

### Deep Learning

* TensorFlow
* Keras
* MobileNetV2 (Transfer Learning)

### Data Processing

* NumPy
* Pandas
* OpenCV

### Visualization

* Matplotlib

### Machine Learning Utilities

* Scikit-learn

### Web Framework (Optional Deployment)

* Flask

---

# 📂 Project Structure

```text
Vegetable-Disease-Classification/
│
├── dataset/
│   ├── train/
│   ├── validation/
│   └── test/
│
├── models/
│   └── vegetable_disease_model.h5
│
├── notebooks/
│   └── training.ipynb
│
├── app.py
├── predict.py
├── train.py
├── requirements.txt
├── README.md
└── assets/
```

---

# 📊 Dataset

The dataset contains images of healthy and diseased vegetable leaves.

Example vegetables include:

* Tomato
* Potato
* Pepper
* Cabbage
* Cauliflower
* Broccoli
* Cucumber
* Pumpkin
* Onion

Each class contains hundreds of labeled images used for training and validation.

---

# ⚙️ Model Architecture

The project uses **Transfer Learning** with **MobileNetV2**.

Pipeline:

```
Input Image
      │
Image Preprocessing
      │
Data Augmentation
      │
MobileNetV2 Base Model
      │
Global Average Pooling
      │
Dense Layer
      │
Dropout
      │
Softmax Output Layer
```

---

# 🖼 Image Preprocessing

The following preprocessing steps were applied:

* Resize images
* Normalize pixel values
* Data augmentation
* Image batching
* Shuffle dataset

Data augmentation techniques:

* Rotation
* Horizontal Flip
* Zoom
* Width Shift
* Height Shift

---

# 🎯 Training Details

| Parameter     | Value                    |
| ------------- | ------------------------ |
| Model         | MobileNetV2              |
| Image Size    | 224 × 224                |
| Optimizer     | Adam                     |
| Loss Function | Categorical Crossentropy |
| Batch Size    | 32                       |
| Epochs        | 20–30                    |
| Framework     | TensorFlow/Keras         |

---

# 📈 Results

The trained model achieved approximately:

* ✅ Training Accuracy: **90%+**
* ✅ Validation Accuracy: **85%**
* ✅ Fast prediction time
* ✅ Good generalization on unseen images

> Accuracy may vary depending on the dataset split and training configuration.

---

# 💻 Installation

Clone the repository:

```bash
git clone https://github.com/your-username/Vegetable-Disease-Classification.git
```

Move into the project directory:

```bash
cd Vegetable-Disease-Classification
```

Install dependencies:

```bash
pip install -r requirements.txt
```

---

# ▶️ Run the Project

### Train the Model

```bash
python train.py
```

### Run Prediction

```bash
python predict.py
```

### Run Flask Application

```bash
python app.py
```

Open your browser:

```
http://127.0.0.1:5000
```

---

# 📷 How It Works

1. Upload a vegetable leaf image.
2. The image is preprocessed.
3. The trained MobileNetV2 model analyzes the image.
4. The model predicts the disease class.
5. The confidence score is displayed.
6. The predicted result is returned to the user.

---

# 🌍 Applications

* Smart Farming
* Precision Agriculture
* Crop Disease Monitoring
* Agricultural Research
* Farmer Assistance Systems
* Educational Projects

---

# 🔮 Future Improvements

* Support more vegetable species
* Real-time disease detection using a mobile camera
* Disease severity estimation
* Treatment and fertilizer recommendations
* Multi-language support
* Cloud deployment
* Android application

---

# 📦 Requirements

```text
Python 3.10+
TensorFlow
Keras
NumPy
Pandas
OpenCV
Matplotlib
Scikit-learn
Flask
```

Install using:

```bash
pip install -r requirements.txt
```

---

# 📸 Sample Workflow

```
Leaf Image
      │
      ▼
Image Preprocessing
      │
      ▼
Deep Learning Model
      │
      ▼
Disease Prediction
      │
      ▼
Confidence Score
      │
      ▼
Display Result
```

---

# 🤝 Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a new branch.
3. Commit your changes.
4. Push the branch.
5. Open a Pull Request.

---

# 📄 License

This project is intended for educational and research purposes. You are free to use and modify it with appropriate attribution.

---

# 👨‍💻 Author

**Ritik Gupta**

B.Tech – Artificial Intelligence & Data Science

Interested in:

* Artificial Intelligence
* Deep Learning
* Machine Learning
* Computer Vision
* Data Science
* Smart Agriculture

---
<img width="1024" height="1536" alt="image" src="https://github.com/user-attachments/assets/973555bb-e399-42bc-846e-f1ef8b114738" />


## ⭐ Support

If you found this project useful, consider giving it a **⭐ Star** on GitHub. It helps others discover the project and motivates future improvements.

Thank you for visiting this repository!
