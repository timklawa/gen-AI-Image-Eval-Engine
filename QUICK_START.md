# Rareplanes Dataset Analyzer - Quick Start Guide

## 🚀 Quick Start

Your React app for analyzing GenAI vision models against the Rareplanes dataset is ready! Here's how to get started:

### 1. Navigate to the App Directory
```bash
cd rareplanes-analyzer
```

### 2. Start the Application
```bash
./start.sh
```

This will:
- Install dependencies (if needed)
- Start the backend server on port 3001
- Start the React app on port 3000
- Open your browser automatically

### 3. Configure OpenAI API
1. Go to the Settings page in the app
2. Enter your OpenAI API key
3. Select your preferred model (GPT-4 Vision Preview recommended)
4. Save the settings

## 🎯 What You Can Do

### Browse the Dataset
- **Grid View**: See all images from train, validation, or test subsets
- **Subset Selection**: Use the dropdown to switch between datasets
- **Image Cards**: Each card shows object count and class information

### Analyze Individual Images
- **Click any image** to view it in detail
- **Toggle Labels**: Show/hide YOLO bounding boxes and class labels
- **View Summary**: See object count and classes above the image
- **AI Analysis**: Enter custom prompts and test OpenAI's vision models

### Test AI Models
- Enter prompts like:
  - "Count and classify all objects in this image"
  - "Describe what you see in this aerial image"
  - "How many aircraft can you identify?"
- Compare AI results with the ground truth labels

## 📊 Dataset Information

Your dataset contains:
- **Training Set**: 741 images with labels
- **Validation Set**: 146 images with labels  
- **Test Set**: 408 images with labels
- **Total**: 1,295 images with YOLO format annotations
- **Classes**: 30 different aircraft types (numbered 0-29)

## 🔧 Manual Setup (Alternative)

If the startup script doesn't work, you can run the servers manually:

**Terminal 1 (Backend):**
```bash
cd rareplanes-analyzer
npm run server
```

**Terminal 2 (Frontend):**
```bash
cd rareplanes-analyzer
npm start
```

## 🐛 Troubleshooting

### Images Not Loading
- Ensure the backend server is running on port 3001
- Check the browser console for errors
- Verify the dataset path in `server.js` is correct

### OpenAI API Issues
- Check your API key in Settings
- Ensure you have sufficient credits
- Try a different model if one fails

### Port Conflicts
- If port 3000 or 3001 are in use, you may need to stop other applications
- Check what's running: `lsof -i :3000` and `lsof -i :3001`

## 📁 File Structure

```
rareplanes-analyzer/
├── src/
│   ├── components/          # React components
│   ├── services/           # API services
│   ├── types/              # TypeScript types
│   └── App.tsx            # Main app component
├── server.js              # Backend server
├── start.sh               # Startup script
├── test-setup.js          # Setup verification
└── README.md              # Detailed documentation
```

## 🎉 You're Ready!

The app is fully functional and ready to analyze your Rareplanes dataset. You can now:

1. Browse through the 1,295 images in the dataset
2. View YOLO annotations as bounding boxes
3. Test AI models with custom prompts
4. Compare AI results with ground truth labels

Happy analyzing! 🛩️

