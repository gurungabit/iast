import { useMemo } from 'react'
import * as api from '../services/api'

export function useApi() {
  return useMemo(() => ({
    getExecutions: api.getExecutions,
    getPolicies: api.getPolicies,
  }), [])
}

export default useApi
