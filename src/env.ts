// Suppress TensorFlow C++ informational logs (AVX2 FMA, etc.)
// Must be set before importing @tensorflow/tfjs-node
process.env.TF_CPP_MIN_LOG_LEVEL = '2';
