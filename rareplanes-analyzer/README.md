# Rareplanes LLM Evaluation Tool

A comprehensive evaluation platform for testing multiple Large Language Models (LLMs) against the Rareplanes aircraft detection dataset. This tool allows researchers and developers to compare the performance of different vision-enabled LLMs on aircraft detection and classification tasks.

## 🎯 What This Tool Does

### Core Functionality
- **Multi-Model Evaluation**: Test multiple LLMs simultaneously against the same image samples
- **Aircraft Detection**: Evaluate how well different models can identify and count aircraft in images
- **Classification Accuracy**: Measure accuracy of aircraft type classification (7 different aircraft classes)
- **Real-time Progress**: Monitor evaluation progress with live updates and progress bars
- **Comparative Analysis**: Side-by-side comparison of model performance with detailed charts

### Supported LLM Providers
- **OpenAI**: GPT-4o, GPT-4 Vision, GPT-4o-mini
- **Anthropic**: Claude Opus 4.1, Claude Opus 4, Claude Sonnet 4, Claude 3.7 Sonnet, Claude 3.5 Sonnet, Claude 3 Opus
- **Groq**: Llama 3.1 8B, Llama 3.1 70B, Mixtral 8x7B
- **Google**: Gemini 2.5 Flash
- **xAI**: Grok-4 Fast Reasoning, Grok-4 Fast Non-Reasoning
- **Azure OpenAI**: GPT-4 Vision models
- **AWS Bedrock**: Claude models via Bedrock

## 🚀 Quick Start

### 1. Clone and Install
```bash
git clone https://github.com/timklawa/gen-AI-Image-Eval-Engine.git
cd gen-AI-Image-Eval-Engine/rareplanes-analyzer
npm install
```

### 2. Configure Environment Variables
Copy the example environment file and add your API keys:
```bash
cp .env.example .env
```

Edit `.env` with your API keys (you need at least one):
```bash
# OpenAI API Key
REACT_APP_OPENAI_API_KEY=sk-your_openai_api_key_here

# Groq API Key  
REACT_APP_GROQ_API_KEY=gsk_your_groq_api_key_here

# Anthropic API Key
REACT_APP_ANTHROPIC_API_KEY=sk-ant-your_anthropic_api_key_here

# Google Gemini API Key
REACT_APP_GOOGLE_API_KEY=your_google_api_key_here

# xAI API Key
REACT_APP_XAI_API_KEY=your_xai_api_key_here

# Azure OpenAI (optional)
REACT_APP_AZURE_API_KEY=your_azure_api_key_here
REACT_APP_AZURE_ENDPOINT=https://your-resource.openai.azure.com/

# AWS Bedrock (optional)
REACT_APP_AWS_ACCESS_KEY_ID=your_aws_access_key_here
REACT_APP_AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here
REACT_APP_AWS_REGION=us-east-1
```

### 3. Customize Configuration (Optional)
The tool comes with sensible defaults, but you can customize:
- **LLM Providers**: Edit `src/config/llmProviders.json` to add/modify models
- **Evaluation Settings**: Edit `src/config/evalConfig.json` to customize prompts and ontology
- **System Prompt**: Modify the default prompt sent to LLMs
- **Aircraft Ontology**: Update classification system and examples
- **UI Settings**: Change default sample size and display options

### 4. Configure LLM Models
Edit `src/config/llmProviders.json` to customize which models you want to test:

```json
{
  "providers": [
    {
      "id": "openai",
      "name": "OpenAI",
      "models": [
        {
          "id": "gpt-4o",
          "name": "GPT-4o",
          "supportsVision": true,
          "costPer1kInput": 0.005,
          "costPer1kOutput": 0.015
        }
      ]
    }
  ]
}
```

### 4. Add Your Dataset
Place your Rareplanes dataset in the `dataset/` directory:
```
dataset/
├── data.yaml
├── train/
│   ├── images/     # .jpg files
│   └── labels/     # .txt files (YOLO format)
├── valid/
│   ├── images/
│   └── labels/
└── test/
    ├── images/
    └── labels/
```

### 5. Run the Application
```bash
# Start both frontend and backend
npm run dev

# Or start separately
npm run server  # Backend on port 3001
npm start       # Frontend on port 3000
```

## 🎮 How to Use

### 1. Select Models for Evaluation
- Choose a sample size (number of images to evaluate)
- Select models from the dropdown (grouped by provider)
- Click "Add Model" to add each model you want to test
- Review selected models in the tags section

### 2. Configure Evaluation Settings
- **System Prompt**: Customize the prompt sent to each LLM
- **Include Ontology**: Toggle aircraft class definitions in the prompt
- **Confidence Threshold**: Set minimum confidence for detections
- **Sample Size**: Number of images to evaluate

### 3. Generate Sample and Run Evaluation
- Click "Generate Sample" to create a random sample from the training set
- Navigate to individual model tabs
- Click "Run Evaluation" to start analysis
- Monitor real-time progress and results

### 4. Analyze Results
- **Individual Model Tabs**: View detailed results for each model
- **Summary Analysis**: Compare all models side-by-side
- **Download Reports**: Export results as CSV or JSON
- **View Charts**: Analyze accuracy metrics and performance

## 📊 Understanding the Results

### Evaluation Metrics
- **Count Accuracy**: How accurately the model predicts total aircraft count
- **Class Accuracy**: How well the model identifies aircraft types
- **Overall Score**: Combined accuracy metric

### Aircraft Classes (0-6)
- **Class 0**: Large Civil Transport (Boeing 747, Airbus A380)
- **Class 1**: Medium Civil Transport (Boeing 737, Airbus A320)
- **Class 2**: Military Bomber (B-52, B-1B)
- **Class 3**: Military Fighter (F-16, F-22)
- **Class 4**: Military Trainer (T-38, Hawk)
- **Class 5**: Military Transport (C-130, C-17)
- **Class 6**: Small Civil Transport (Cessna, Piper)

### Charts and Visualizations
- **Count Accuracy by Image**: Bar chart showing accuracy for each image
- **Class Accuracy by Image**: Bar chart showing class accuracy per image
- **Model Comparison**: Multi-bar charts comparing models across metrics

## ⚙️ Configuration Options

### LLM Provider Configuration
Edit `src/config/llmProviders.json` to:
- Add/remove LLM providers
- Modify model parameters (costs, token limits)
- Enable/disable specific models
- Update model names and descriptions

### Evaluation Configuration
Edit `src/config/evalConfig.json` to customize:
- **Default System Prompt**: The base prompt sent to LLMs for aircraft detection
- **Aircraft Ontology**: Classification system matching the Rareplanes dataset (7 aircraft types)
- **Structured Output**: JSON format requirements and validation rules
- **UI Settings**: Default sample size, display options, and feature toggles

#### Key Configuration Sections:
```json
{
  "defaultSystemPrompt": "You are an expert aircraft detection and classification system...",
  "defaultOntology": {
    "0": { "name": "Large Civil Transport" },
    "1": { "name": "Medium Civil Transport" },
    "2": { "name": "Military Bomber" },
    "3": { "name": "Military Fighter" },
    "4": { "name": "Military Trainer" },
    "5": { "name": "Military Transport" },
    "6": { "name": "Small Civil Transport" }
  },
  "defaultStructuredOutput": {
    "enabled": true,
    "format": "json",
    "requiredFields": ["objects", "count", "countConfidence"],
    "example": "{\n  \"objects\": [\n    {\n      \"class\": 0,\n      \"className\": \"Large Civil Transport\",\n      \"confidence\": 0.95\n    }\n  ],\n  \"count\": 1,\n  \"countConfidence\": 0.92\n}"
  },
  "ui": {
    "defaultSampleSize": 5,
    "maxSampleSize": 50,
    "showCostEstimates": true
  }
}
```

### Environment Variables
- **API Keys**: Set for each provider you want to use
- **Server Configuration**: Customize API base URL if needed
- **Optional Settings**: Azure endpoints, AWS regions, etc.

### Dataset Configuration
- **Sample Size**: Number of images to evaluate (1-1000+)
- **Subset Selection**: Choose from train/valid/test splits
- **Image Quality**: Ensure images are in .jpg format
- **Label Format**: YOLO format with normalized coordinates

## 🔧 Troubleshooting

### Common Issues

#### API Key Errors
- Verify API keys are correctly set in `.env` file
- Ensure API keys have sufficient credits/permissions
- Check that model names in `llmProviders.json` are current

#### Dataset Issues
- Ensure dataset is in the correct directory structure
- Verify image files are accessible and in .jpg format
- Check that label files match image files

#### Model Selection Issues
- Ensure at least one model is selected before generating sample
- Check that selected models support vision/image analysis
- Verify API keys are available for selected providers

### Performance Tips
- Use smaller sample sizes for faster evaluation
- Close unused browser tabs to free up memory
- Ensure stable internet connection for API calls
- Monitor API usage and costs

## 📁 Project Structure

```
rareplanes-analyzer/
├── src/
│   ├── components/          # React UI components
│   ├── config/
│   │   └── llmProviders.json # LLM provider configurations
│   ├── services/            # API and evaluation services
│   └── types/               # TypeScript definitions
├── dataset/                 # Your Rareplanes dataset
├── server.js               # Express backend server
├── .env.example            # Environment variables template
└── README.md               # This file
```

## 🚀 Deployment

For production deployment, see [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions on:
- VPS/Server deployment
- Docker containerization
- Cloud platform deployment (Heroku, Vercel, AWS)
- Environment configuration
- Monitoring and maintenance

## 📄 License

This project is for educational and research purposes. The Rareplanes dataset is licensed under CC BY 4.0.

## 🙏 Acknowledgments

- **Rareplanes Dataset**: Aircraft detection dataset for computer vision research
- **LLM Providers**: OpenAI, Groq, Anthropic, Azure, and AWS for API access
- **React & Recharts**: For the modern UI and data visualization

---

**Ready to evaluate your LLMs?** Start by configuring your API keys and selecting the models you want to test!