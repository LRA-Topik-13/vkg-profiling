import axios from 'axios'

const client = axios.create({
  baseURL: '/api',
})

const RETRY_DELAYS_MS = [2000, 4000, 8000, 15000]

client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config
    if (!config) return Promise.reject(err)

    const status = err.response?.status
    const retryCount = config._retryCount ?? 0
    const isRetryable = !err.response || status === 502 || status === 503

    if (isRetryable && retryCount < RETRY_DELAYS_MS.length) {
      config._retryCount = retryCount + 1
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[retryCount]))
      return client(config)
    }

    return Promise.reject(err)
  }
)

// ─── Metadata ────────────────────────────────────────────────────────────────
export const getClasses = () =>
  client.get('/metadata/mapped-classes').then((r) => r.data)

export const getProperties = (className) =>
  client.get('/metadata/mapped-properties', { params: { class_name: className } }).then((r) => r.data)

export const getFacetValues = (className, property) =>
  client.get('/metadata/facets', { params: { class_name: className, property } }).then((r) => r.data)

// ─── Conciseness ─────────────────────────────────────────────────────────────
export const getConcisenessIntraSource = ({ classUri, identityProps, sourcePrefix, sampleLimit }) =>
  client.get('/conciseness/intra-source', {
    params: {
      class_uri: classUri,
      identity_props: identityProps,
      source_prefix: sourcePrefix,
      sample_limit: sampleLimit || undefined,
    },
  }).then((r) => r.data)

export const getConcisenessCrossSource = ({ classUri, identityProps, sources, sampleLimit }) =>
  client.get('/conciseness/cross-source', {
    params: {
      class_uri: classUri,
      identity_props: identityProps,
      sources: sources || undefined,
      sample_limit: sampleLimit || undefined,
    },
  }).then((r) => r.data)
