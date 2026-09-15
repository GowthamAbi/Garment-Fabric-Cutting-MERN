import { useEffect, useState } from "react";
export default function useFetch(loader, dependencies = []) {
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(null);
  useEffect(() => {
    setLoading(true);
    loader()
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, dependencies);
  return { data, loading, error, reload: () => loader().then(setData) };
}
