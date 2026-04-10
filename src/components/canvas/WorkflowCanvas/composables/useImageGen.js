import { ref } from 'vue'

const STORAGE_KEY_ENDPOINT = 'wf_imagegen_endpoint'
const STORAGE_KEY_APIKEY = 'wf_imagegen_apikey'
const STORAGE_KEY_MODEL = 'wf_imagegen_model'

const DEFAULT_ENDPOINT = 'https://api.minimaxi.com'
const DEFAULT_MODEL = 'image-01'

/**
 * MiniMax Image Generation API composable.
 * Config stored in localStorage; pass node's data object to mutate it with results.
 *
 * @param {Object} nodeData - The node's data object (will be mutated: data.imageUrls, data.loading, data.error)
 */
export function useImageGen(nodeData) {
  const endpoint = localStorage.getItem(STORAGE_KEY_ENDPOINT) || DEFAULT_ENDPOINT
  const apiKey = localStorage.getItem(STORAGE_KEY_APIKEY) || ''
  const defaultModel = localStorage.getItem(STORAGE_KEY_MODEL) || DEFAULT_MODEL

  async function generate(payload) {
    if (!apiKey) {
      throw new Error('API key not configured. Click the 🔐 icon in the toolbar to set your API key and endpoint.')
    }

    nodeData.loading = true
    nodeData.error = null
    nodeData.imageUrls = []

    try {
      const response = await fetch(`${endpoint}/v1/image_generation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      })

      const json = await response.json()

      if (json.base_resp?.status_code !== 0) {
        throw new Error(json.base_resp?.status_msg || `Error ${json.base_resp?.status_code}`)
      }

      nodeData.imageUrls = json.data?.image_urls || json.data?.image_base64 || []
    } catch (err) {
      nodeData.error = err.message
      throw err
    } finally {
      nodeData.loading = false
    }
  }

  async function textToImage({
    prompt,
    model = defaultModel,
    styleType,
    styleWeight,
    aspectRatio = '1:1',
    n = 1,
    promptOptimizer = false,
    aigcWatermark = false,
    responseFormat = 'url'
  }) {
    const payload = {
      model,
      prompt,
      aspect_ratio: aspectRatio,
      n,
      prompt_optimizer: promptOptimizer,
      aigc_watermark: aigcWatermark,
      response_format: responseFormat
    }

    if (model === 'image-01-live' && styleType) {
      payload.style = {
        style_type: styleType,
        style_weight: styleWeight || 0.8
      }
    }

    await generate(payload)
  }

  async function imageToImage({
    prompt,
    imageUrl,
    model = defaultModel,
    styleType,
    styleWeight,
    aspectRatio = '1:1',
    n = 1,
    promptOptimizer = false,
    aigcWatermark = false,
    responseFormat = 'url'
  }) {
    const payload = {
      model,
      prompt,
      aspect_ratio: aspectRatio,
      n,
      prompt_optimizer: promptOptimizer,
      aigc_watermark: aigcWatermark,
      response_format: responseFormat,
      subject_reference: [
        {
          type: 'character',
          image_file: imageUrl
        }
      ]
    }

    if (model === 'image-01-live' && styleType) {
      payload.style = {
        style_type: styleType,
        style_weight: styleWeight || 0.8
      }
    }

    await generate(payload)
  }

  return { textToImage, imageToImage }
}

// --- Config management (shared singleton) ---

export const apiConfig = ref({
  endpoint: localStorage.getItem(STORAGE_KEY_ENDPOINT) || DEFAULT_ENDPOINT,
  apiKey: localStorage.getItem(STORAGE_KEY_APIKEY) || '',
  model: localStorage.getItem(STORAGE_KEY_MODEL) || DEFAULT_MODEL
})

export function saveApiConfig(endpoint, apiKey, model) {
  localStorage.setItem(STORAGE_KEY_ENDPOINT, endpoint)
  localStorage.setItem(STORAGE_KEY_APIKEY, apiKey)
  localStorage.setItem(STORAGE_KEY_MODEL, model)
  apiConfig.value = { endpoint, apiKey, model }
}

export function hasApiKey() {
  return !!localStorage.getItem(STORAGE_KEY_APIKEY)
}
