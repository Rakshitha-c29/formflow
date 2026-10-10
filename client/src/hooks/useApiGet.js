import { useCallback, useEffect, useState } from "react";
import api, { getApiError } from "../services/api";

// GETs `url` on mount, when `url` changes, and when reload() is called.
// State is only set from the request's callbacks, and responses for a
// URL the page has moved away from are ignored.
export function useApiGet(url, fallbackMessage = "Could not load data.") {
    const [reloadCount, setReloadCount] = useState(0);
    const requestKey = `${url}#${reloadCount}`;

    const [result, setResult] = useState({ key: null, url: null, data: null, error: null });

    useEffect(() => {
        let ignore = false;

        api.get(url)
            .then((response) => {
                if (!ignore) setResult({ key: requestKey, url, data: response.data, error: null });
            })
            .catch((err) => {
                if (ignore) return;

                // Keep showing the last good data for this URL if a refresh fails
                setResult((previous) => ({
                    key: requestKey,
                    url,
                    data: previous.url === url ? previous.data : null,
                    error: getApiError(err, fallbackMessage),
                }));
            });

        return () => {
            ignore = true;
        };
    }, [url, requestKey, fallbackMessage]);

    const reload = useCallback(() => setReloadCount((count) => count + 1), []);

    // For applying a mutation's response without refetching
    const setData = useCallback((update) => {
        setResult((previous) => ({ ...previous, data: update(previous.data) }));
    }, []);

    return {
        data: result.url === url ? result.data : null,
        error: result.url === url ? result.error : null,
        loading: result.key !== requestKey,
        reload,
        setData,
    };
}
