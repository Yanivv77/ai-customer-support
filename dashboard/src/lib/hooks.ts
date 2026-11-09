import { useEffect, useState } from "react"

/** The value, once it has stopped changing for `delay` ms. Keeps typing from firing a request per key. */
export function useDebounced<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
