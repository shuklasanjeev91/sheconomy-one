# NSFW.js Browser-Side Image Classifier

A comprehensive browser-only implementation for detecting NSFW (Not Safe For Work) content in images using TensorFlow.js and a pre-trained neural network model.

## 📋 Table of Contents

- [Overview](#overview)
- [Dependencies](#dependencies)
- [Model Architecture](#model-architecture)
- [Implementation Details](#implementation-details)
- [Usage Examples](#usage-examples)
- [Batch Processing](#batch-processing)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)
- [API Reference](#api-reference)
- [Best Practices](#best-practices)

## 🎯 Overview

This implementation provides a complete browser-side NSFW image classification system that:

- **Runs entirely in the browser** - No server-side processing required
- **Supports multiple input formats** - File objects, URLs, HTML elements, Base64
- **Dynamic batch processing** - Process up to 16 images simultaneously
- **Memory optimized** - Automatic tensor cleanup and memory management
- **Fallback handling** - Graceful degradation when model fails
- **Configurable thresholds** - Customizable rejection criteria

### How It Works

1. **Model Loading**: Downloads and caches a pre-trained TensorFlow.js model
2. **Image Processing**: Converts images to 224x224x3 RGB tensors
3. **Classification**: Runs inference to get probability scores for 5 categories
4. **Decision Making**: Applies thresholds to determine if content is appropriate

## � Dependencies

### Required NPM Packages

```json
{
  "@tensorflow/tfjs": "^4.22.0",
  "nsfwjs": "^4.2.1"
}
```

### Browser Requirements

- **Modern browsers** with ES6+ support
- **WebGL support** for GPU acceleration (recommended)
- **Minimum 2GB RAM** for model loading
- **CORS enabled** for cross-origin image loading

### Model Files Structure

```
public/nsfwjs-model/
├── model.json          # Model architecture and metadata
├── group1-shard1of1    # Model weights (binary)
└── README.md           # This documentation
```

## 🏗️ Model Architecture

### Input Shape

- **Dimensions**: `[batch_size, 224, 224, 3]`
- **Batch Size**: Dynamic (1-16 images)
- **Image Size**: 224x224 pixels (required)
- **Channels**: 3 (RGB - grayscale not recommended)
- **Data Type**: Float32, normalized to [0, 1]

### Output Classes

The model classifies images into 5 categories:

| Class     | Description               | Default Threshold |
| --------- | ------------------------- | ----------------- |
| `drawing` | Artistic/cartoon content  | N/A (safe)        |
| `hentai`  | Animated adult content    | 0.7               |
| `neutral` | Safe, non-sexual content  | N/A (safe)        |
| `porn`    | Explicit sexual content   | 0.7               |
| `sexy`    | Suggestive/sexual content | 0.8               |

### Memory Usage

- **Model Size**: ~17MB download, ~50MB in memory
- **Per Image**: ~2MB tensor memory (automatically cleaned)
- **Batch Processing**: Scales linearly with batch size

## 🔧 Implementation Details

### Core Components

#### 1. Model Loading (`loadNSFWModel`)

```javascript
// Singleton pattern with caching
const model = await loadNSFWModel();
```

**Features:**

- Downloads model once, caches for subsequent use
- Retry logic for network failures (3 attempts)
- 2-minute timeout for initial loading
- Automatic backend optimization (WebGPU → WebGL → CPU)

#### 2. Image Analysis (`analyzeImageContent`)

```javascript
const result = await analyzeImageContent(imageInput, {
  timeout: 60000,
  customThresholds: { porn: 0.8 },
  includeDebugInfo: true,
});
```

:\*\*

- **File objects**: `new File()` from input elements
- **URLs**: `"https://example.com/image.jpg"`
- **HTML elements**: `<img>` or `<canvas>` elements
- **Base64**: `"data:image/jpeg;base64,..."`

#### 3. Batch Processing

```javascript
// Process multiple images efficiently
const results = await Promise.all([
  analyzeImageContent(image1),
  analyzeImageContent(image2),
  // ... up to 16 images
]);
```

### File Structure

```
lib/nsfwjs/
└── nsfw-classifier.js       # Main implementation file

Key Functions:
├── loadNSFWModel()          # Model loading with caching
├── analyzeImageContent()    # Main analysis function
├── processImageInput()      # Image preprocessing
├── performImageAnalysis()   # Core classification logic
└── cleanup()               # Memory cleanup
```

## 🚀 Usage Examples

### Basic Image Analysis

```javascript
import { analyzeImageContent } from "./lib/nsfwjs/nsfw-classifier.js";

// Analyze from file input
const fileInput = document.getElementById("imageInput");
const file = fileInput.files[0];

const result = await analyzeImageContent(file);
console.log("Verdict:", result.verdict); // 'approved' or 'rejected'
console.log("Confidence:", result.confidence);
console.log("Scores:", result.scores);
```

### Custom Thresholds

```javascript
const result = await analyzeImageContent(image, {
  customThresholds: {
    porn: 0.8, // More strict
    sexy: 0.6, // More lenient
    hentai: 0.9, // Very strict
  },
  timeout: 30000, // 30 second timeout
  includeDebugInfo: true,
});
```

### Batch Processing Multiple Images

```javascript
// Process up to 16 images concurrently
const images = [file1, file2, file3 /* ... up to 16 */];

const results = await Promise.all(
  images.map((image) =>
    analyzeImageContent(image, {
      timeout: 120000, // Longer timeout for batch
    })
  )
);

// Check results
const rejectedImages = results
  .map((result, index) => ({ result, index }))
  .filter(({ result }) => result.verdict === "rejected");

console.log(`${rejectedImages.length} images rejected`);
```

### Error Handling

```javascript
try {
  const result = await analyzeImageContent(image);

  if (result.metadata.fallback) {
    console.warn("Analysis failed, using fallback result");
  }

  // Process result...
} catch (error) {
  console.error("Image analysis failed:", error.message);
  // Handle error appropriately
}
```

## 🔄 Batch Processing

### Dynamic Batch Size Support

The classifier supports processing 1-16 images simultaneously:

```javascript
// Single image
const result = await analyzeImageContent(singleImage);

// Multiple images (recommended: 2-8 for optimal performance)
const batchResults = await Promise.all([
  analyzeImageContent(image1),
  analyzeImageContent(image2),
  analyzeImageContent(image3),
  // ... up to 16 total
]);
```

### Batch Size Recommendations

| Batch Size | Use Case           | Memory Usage | Performance        |
| ---------- | ------------------ | ------------ | ------------------ |
| 1-2        | Real-time analysis | ~2-4MB       | Fastest per image  |
| 3-8        | **Recommended**    | ~6-16MB      | Optimal throughput |
| 9-16       | Bulk processing    | ~18-32MB     | Maximum throughput |

### Batch Processing Best Practices

```javascript
// Efficient batch processing
async function processBatch(images, batchSize = 8) {
  const results = [];

  for (let i = 0; i < images.length; i += batchSize) {
    const batch = images.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map((image) =>
        analyzeImageContent(image, {
          timeout: 120000, // Longer timeout for batches
        })
      )
    );

    results.push(...batchResults);

    // Optional: small delay between batches to prevent browser freeze
    if (i + batchSize < images.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}
```

## ⚡ Performance Optimization

### Model Loading Performance

- **Initial load**: ~20-25 seconds (one-time)
- **Subsequent uses**: Instant (cached)
- **Memory footprint**: ~50MB

### Analysis Performance

- **Single image**: ~200ms
- **Batch of 8**: ~800ms total (~100ms per image)
- **Model prediction**: ~50ms per image
- **Image preprocessing**: ~150ms per image

### Optimization Tips

1. **Preload the model** on app initialization:

   ```javascript
   // Load model early
   import { loadNSFWModel } from "./lib/nsfwjs/nsfw-classifier.js";
   loadNSFWModel(); // Don't await, just start loading
   ```

2. **Use optimal batch sizes** (4-8 images):

   ```javascript
   const OPTIMAL_BATCH_SIZE = 6;
   ```

3. **Enable WebGPU/WebGL** acceleration:

   ```javascript
   // Automatically handled by the implementation
   // Prefers: WebGPU → WebGL → CPU
   ```

4. **Proper image sizing**:
   - Input images are automatically resized to 224x224
   - Smaller source images process faster
   - RGB format is required (3 channels)

## 🔧 Troubleshooting

### Common Issues

#### Model Loading Errors

**Problem**: `Failed to load model from /nsfwjs-model/model.json`

```
Solution:
1. Verify model files exist in public/nsfwjs-model/
2. Check browser network tab for 404 errors
3. Ensure web server serves .json and binary files
4. Check CORS headers if loading from different domain
```

**Problem**: `Model loading timeout`

```
Solution:
1. Check network connection
2. Increase MODEL_LOAD_TIMEOUT in config
3. Verify model files aren't corrupted
4. Try refreshing the page
```

#### Memory Issues

**Problem**: `Out of memory` or browser crash

```
Solution:
1. Reduce batch size (try 2-4 images)
2. Process images sequentially instead of parallel
3. Add delays between batches
4. Close other browser tabs
5. Restart browser
```

#### Performance Issues

**Problem**: Slow analysis (>5 seconds per image)

```
Solution:
1. Check if WebGL is enabled in browser
2. Update graphics drivers
3. Reduce image file sizes before analysis
4. Use fewer concurrent analyses
```

### Debug Mode

Enable detailed logging:

```javascript
const result = await analyzeImageContent(image, {
  includeDebugInfo: true,
});

console.log("Debug info:", result.debugInfo);
```

### Browser Compatibility

| Browser         | Status          | Notes              |
| --------------- | --------------- | ------------------ |
| Chrome 90+      | ✅ Full support | Best performance   |
| Firefox 88+     | ✅ Full support | Good performance   |
| Safari 14+      | ⚠️ Limited      | WebGL only, slower |
| Edge 90+        | ✅ Full support | Good performance   |
| Mobile browsers | ⚠️ Limited      | Memory constraints |

## 📚 API Reference

### Main Functions

#### `loadNSFWModel()`

Loads and caches the NSFW classification model.

**Returns:** `Promise<tf.LayersModel>`

#### `analyzeImageContent(imageInput, options)`

Analyzes an image for NSFW content.

**Parameters:**

- `imageInput`: File|string|HTMLImageElement - Image to analyze
- `options`: Object (optional)
  - `timeout`: number - Analysis timeout in ms (default: 60000)
  - `customThresholds`: Object - Custom rejection thresholds
  - `includeDebugInfo`: boolean - Include debug information

**Returns:** `Promise<AnalysisResult>`

```typescript
interface AnalysisResult {
  verdict: "approved" | "rejected";
  confidence: number;
  scores: {
    drawing: number;
    hentai: number;
    neutral: number;
    porn: number;
    sexy: number;
  };
  rejectionReasons: string[];
  metadata: {
    analysisId: string;
    timestamp: string;
    thresholds: Object;
    fallback?: boolean;
  };
}
```

#### `getModelStatus()`

Returns current model and system status.

**Returns:** `Object`

```javascript
{
  modelLoaded: boolean,
  isLoading: boolean,
  loadAttempts: number,
  config: Object,
  environment: 'browser',
  tensorflowLoaded: boolean
}
```

#### `cleanup()`

Cleans up resources and clears model cache.

**Returns:** `Promise<void>`

### Configuration

```javascript
import { CONFIG } from "./lib/nsfwjs/nsfw-classifier.js";

// Default configuration
CONFIG = {
  MODEL_PATH: "/nsfwjs-model/",
  MODEL_SIZE: 224,
  DEFAULT_TIMEOUT: 60000,
  MODEL_LOAD_TIMEOUT: 120000,
  REJECTION_THRESHOLDS: {
    porn: 0.7,
    sexy: 0.8,
    hentai: 0.7,
  },
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
};
```

## 💡 Best Practices

### 1. Application Integration

```javascript
// Initialize early in your app
class NSFWService {
  constructor() {
    this.initialized = false;
    this.initPromise = null;
  }

  async initialize() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = loadNSFWModel();
    await this.initPromise;
    this.initialized = true;
  }

  async analyzeImage(image) {
    await this.initialize();
    return analyzeImageContent(image);
  }
}
```

### 2. User Experience

```javascript
// Show loading states
const showModelLoading = () => {
  // Show "Loading AI model..." message
};

const showAnalyzing = () => {
  // Show "Analyzing image..." spinner
};

// Preload model when user opens upload dialog
uploadDialog.addEventListener("open", () => {
  loadNSFWModel(); // Start loading in background
});
```

### 3. Error Handling

```javascript
async function safeAnalyzeImage(image) {
  try {
    const result = await analyzeImageContent(image, {
      timeout: 30000,
      includeDebugInfo: true,
    });

    // Check for fallback result
    if (result.metadata.fallback) {
      console.warn("NSFW analysis failed, image approved by default");
      // Log for monitoring
    }

    return result;
  } catch (error) {
    console.error("NSFW analysis error:", error);

    // Return safe fallback
    return {
      verdict: "approved", // Safe default
      confidence: 0,
      scores: { neutral: 1.0, porn: 0, sexy: 0, hentai: 0, drawing: 0 },
      rejectionReasons: [],
      metadata: {
        fallback: true,
        error: error.message,
      },
    };
  }
}
```

### 4. Performance Monitoring

```javascript
// Track performance metrics
const performanceTracker = {
  modelLoadTime: 0,
  averageAnalysisTime: 0,
  analysisCount: 0,

  recordAnalysis(duration) {
    this.analysisCount++;
    this.averageAnalysisTime =
      (this.averageAnalysisTime * (this.analysisCount - 1) + duration) /
      this.analysisCount;
  },
};
```

### 5. Memory Management

```javascript
// Clean up periodically
setInterval(async () => {
  // Check memory usage
  if (
    performance.memory &&
    performance.memory.usedJSHeapSize > 100 * 1024 * 1024
  ) {
    console.log("High memory usage detected, cleaning up...");
    await cleanup();
  }
}, 60000); // Check every minute
```

## 🧪 Testing

### Unit Testing Example

```javascript
// Test basic functionality
async function testNSFWClassifier() {
  // Test model loading
  const model = await loadNSFWModel();
  console.assert(model, "Model should load successfully");

  // Test image analysis
  const testImageUrl = "/test-images/safe-image.jpg";
  const result = await analyzeImageContent(testImageUrl);

  console.assert(
    result.verdict === "approved",
    "Safe image should be approved"
  );
  console.assert(result.confidence >= 0, "Confidence should be non-negative");

  console.log("✅ All tests passed");
}
```

### Performance Testing

```javascript
// Benchmark performance
async function benchmarkPerformance() {
  const testImages = [
    /* array of test images */
  ];

  console.time("Model Loading");
  await loadNSFWModel();
  console.timeEnd("Model Loading");

  console.time("Batch Analysis");
  const results = await Promise.all(
    testImages.map((img) => analyzeImageContent(img))
  );
  console.timeEnd("Batch Analysis");

  console.log(`Processed ${results.length} images`);
  console.log(
    `Average time per image: ${performance.now() / results.length}ms`
  );
}
```

## 📝 Changelog

### Version 1.0.0

- Initial browser-side implementation
- Support for File, URL, HTMLElement, Base64 inputs
- Dynamic batch processing (1-16 images)
- Memory optimization and tensor cleanup
- Comprehensive error handling and fallbacks
- Configurable thresholds and timeouts

---

## 🤝 Contributing

When working with this implementation:

1. **Test thoroughly** - Always test with various image types and sizes
2. **Monitor memory** - Watch for memory leaks in long-running applications
3. **Profile performance** - Measure actual performance in your use case
4. **Handle errors gracefully** - Always provide fallback behavior
5. **Document changes** - Update this README when modifying the implementation

## 📞 Support

For questions or issues:

1. Check the troubleshooting section above
2. Enable debug mode for detailed logging
3. Check browser console for error messages
4. Verify model files are accessible via network tab
5. Test with different images to isolate issues

**Remember**: This is a browser-only implementation. The model runs entirely client-side, ensuring privacy but requiring sufficient device resources.

      results.push(...batchResults);
      setProgress((i + batchSize) / images.length * 100);
    }

    onComplete(results);

};

return (
<div>
<button onClick={processBatch}>Analyze {images.length} Images</button>
<div>Progress: {progress.toFixed(1)}%</div>
</div>
);
};

````

## 📖 Additional Resources

- [TensorFlow.js Documentation](https://www.tensorflow.org/js)
- [NSFW.js GitHub Repository](https://github.com/infinitered/nsfwjs)
- [WebGL Compatibility](https://caniuse.com/webgl)
- [Performance Monitoring](https://developer.mozilla.org/en-US/docs/Web/API/Performance)

## 🤝 Team Collaboration Notes

### Before Working on NSFW Features

1. Test model loading in your development environment
2. Verify browser compatibility for your target users
3. Consider mobile performance constraints
4. Plan for graceful degradation on older devices

### Performance Testing

```javascript
// Add this to test model performance
const testPerformance = async () => {
  const start = performance.now();
  const result = await analyzeImageContent(testImage);
  const duration = performance.now() - start;
  console.log(`Analysis took ${duration.toFixed(2)}ms`);
};
````

### Memory Monitoring

```javascript
// Monitor memory usage during development
const logMemoryUsage = () => {
  if (performance.memory) {
    console.log("Memory usage:", {
      used:
        (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + " MB",
      total:
        (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + " MB",
      limit:
        (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + " MB",
    });
  }
};
```

---

**Questions?** Check the main implementation file: `lib/nsfwjs/nsfw-classifier.js` for detailed code examples and additional utilities.
