/**
 * Searches the website for anime with the given keyword and returns the results
 * @param {string} keyword The keyword to search for
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the search results in the format: `[{"title": "Title", "image": "Image URL", "href": "URL"}, ...]`
 */
async function searchResults(keyword) {
    const ANIME_URL = 'https://www.animeparadise.moe/anime/';
    const SEARCH_URL = 'https://www.animeparadise.moe/search?q=';
    var shows = [];

    try {
        const response = await fetch(`${SEARCH_URL}${encodeURI(keyword)}`);
        const html = typeof response === 'object' ? await response.text() : await response;

        const json = getNextData(html);
        if (json == null) throw('Error parsing NEXT_DATA json');

        const data = json?.props?.pageProps?.data;
        if(data == null) throw('Error obtaining data');

        const animesWithSubtitles = await GetAnimes();
        
        for(let entry of data) {
            if(!animesWithSubtitles.includes(entry.mappings.anilist)) {
                continue;
            }

            shows.push({
                title: entry.title,
                image: entry.posterImage.original,
                href: ANIME_URL + entry.link
            });
        }

        return JSON.stringify(shows);
    } catch (error) {
        console.log('Test');
        console.log('Fetch error: ' + error.message);
        return JSON.stringify([]);
    }
}

/**
 * Extracts the details (description, aliases, airdate) from the given url
 * @param {string} url The id required to fetch the details
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the details in the format: `[{"description": "Description", "aliases": "Aliases", "airdate": "Airdate"}]`
 */
async function extractDetails(url) {
    const REGEX = /style_specs_header_year.+?>.+([0-9]{4})[\s\S]+style_specs_container_middle.+?>([\s\S]+?)</g;

    try {
        const response = await fetch(url);
        const html = typeof response === 'object' ? await response.text() : await response;

        const json = getNextData(html);
        if (json == null) throw('Error parsing NEXT_DATA json');

        const data = json?.props?.pageProps?.data;
        if(data == null) throw('Error obtaining data');

        let aliasArray = data?.synonyms;
        if(aliasArray != null && aliasArray.length > 5) {
            aliasArray = aliasArray.slice(0, 5);
        }
        const aliases = aliasArray.join(', ');

        const details = {
            description: data?.synopsys,
            aliases: aliases,
            airdate: data?.animeSeason?.season + ' ' + data?.animeSeason?.year
        }

        return JSON.stringify([details]);

    } catch (error) {
        console.log('Details error: ' + error.message);
        return JSON.stringify([{
            description: 'Error loading description',
            aliases: 'Duration: Unknown',
            airdate: 'Aired: Unknown'
        }]);
    }
}

/**
 * Extracts the episodes from the given url.
 * @param {string} url - The id required to fetch the episodes
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the episodes in the format: `[{ "href": "Episode URL", "number": Episode Number }, ...]`.
 * If an error occurs during the fetch operation, an empty array is returned in JSON format.
 */
async function extractEpisodes(url) {
    const BASE_URL = 'https://www.animeparadise.moe/watch/';

    try {
        const response = await fetch(url);
        const html = typeof response === 'object' ? await response.text() : await response;
        var episodes = [];

        const json = getNextData(html);
        if (json == null) throw ('Error parsing NEXT_DATA json');

        const origin = json?.props?.pageProps?.data?._id;

        const episodesList = json?.props?.pageProps?.data?.ep;
        if(episodesList == null) throw('Error obtaining episodes');

        const episodesWithSubtitlesJson = await GetEpisodes(json.props.pageProps.data?.mappings?.anilist);
        const episodesWithSubtitles = episodesWithSubtitlesJson.map((entry) => entry?.episode);

        for(let i=1,len=episodesList.length; i<=len; i++) {
            if(!episodesWithSubtitles.includes(i)) {
                continue;
            }

            let url = `${ BASE_URL }${ episodesList[i] }?origin=${ origin }`;

            episodes.push({
                href: url,
                number: i
            })
        }

        return JSON.stringify(episodes);
    } catch (error) {
        console.log('Fetch error: ' + error.message);
        return JSON.stringify([]);
    }
}

/**
 * Extracts the stream URL from the given url, using a utility function on ac-api.ofchaos.com.
 * @param {string} url - The url to extract the stream URL from.
 * @returns {Promise<string|null>} A promise that resolves with the stream URL if successful, or null if an error occurs during the fetch operation.
 */
async function extractStreamUrl(url) {
    try {
        const response = await fetch(url);
        const html = typeof response === 'object' ? await response.text() : await response;

        const json = getNextData(html);
        if (json == null) throw ('Error parsing NEXT_DATA json');

        const streamUrl = json?.props?.pageProps?.episode?.streamLink;
        const subtitles = GetSubtitles(json.props.pageProps?.animeData?.mappings?.anilist, json.props.pageProps.episode?.number);
        if(subtitles == null) throw('Invalid data while attempting to get subtitles');

        return JSON.stringify({ stream: streamUrl, subtitles: subtitles });

    } catch (error) {
        console.log('Error extracting stream url: ' + error.message);
        return JSON.stringify({ stream: null, subtitles: null });
    }
}

function getNextData(html) {
    const trimmedHtml = trimHtml(html, '__NEXT_DATA__', '</script>');
    const jsonString = trimmedHtml.slice(39);

    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.log('Error parsing NEXT_DATA json');
        return null;
    }
}

// Trims around the content, leaving only the area between the start and end string
function trimHtml(html, startString, endString) {
    const startIndex = html.indexOf(startString);
    const endIndex = html.indexOf(endString, startIndex);
    return html.substring(startIndex, endIndex);
}

/**
 * Gets a list of anime with subtitles from the Jimaku API
 * @returns {Promise<Array<number>>} A promise that resolves with an array of AniList IDs
 */
async function GetAnimes() {
    const API_KEY = 'AAAAAAAABlkuAS5Gu5CmdaJFx5GDWXpl5TGqDsn00SOfknKmwQMPEko-1w';
    const SEARCH_URL = 'https://jimaku.app/api/entries/search';

    try {
        const response = await fetch(SEARCH_URL, {
            method: 'GET',
            headers: {
                'Authorization': API_KEY,
                'Content-Type': 'application/json'
            },
            // Only search for anime entries
            params: {
                anime: true
            }
        });

        if (!response.ok) {
            throw new Error(`API request failed with status: ${response.status}`);
        }

        const data = await response.json();
        
        // Extract the AniList IDs from the entries
        return data
            .filter(entry => entry.anilist_id !== null)
            .map(entry => entry.anilist_id);

    } catch (error) {
        console.log('[JIMAKU][GetAnimes] Error: ' + error.message);
        return [];
    }
}

/**
 * Gets episodes with subtitles for a specific anime from the Jimaku API
 * @param {number} anilistId The AniList ID of the anime
 * @returns {Promise<Array<Object>>} A promise that resolves with an array of episode objects
 */
async function GetEpisodes(anilistId) {
    if (anilistId == null || isNaN(parseInt(anilistId))) {
        return [];
    }

    const API_KEY = 'AAAAAAAABlkuAS5Gu5CmdaJFx5GDWXpl5TGqDsn00SOfknKmwQMPEko-1w';
    const SEARCH_URL = 'https://jimaku.app/api/entries/search';

    try {
        const response = await fetch(`${SEARCH_URL}?anime=true&anilist_id=${anilistId}`, {
            method: 'GET',
            headers: {
                'Authorization': API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API request failed with status: ${response.status}`);
        }

        const entries = await response.json();
        
        if (entries.length === 0) {
            return [];
        }

        // Get the entry ID to fetch its files
        const entryId = entries[0].id;
        const filesResponse = await fetch(`https://jimaku.app/api/entries/${entryId}/files`, {
            method: 'GET',
            headers: {
                'Authorization': API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!filesResponse.ok) {
            throw new Error(`Files API request failed with status: ${filesResponse.status}`);
        }

        const files = await filesResponse.json();
        
        // Extract episode numbers from filenames
        // This is a simplistic approach - the actual implementation may need refinement
        const episodeObjects = [];
        const episodeSet = new Set();
        
        files.forEach(file => {
            // Match episode number format in filename
            const episodeMatch = file.name.match(/[eE](\d+)|episode\s*(\d+)|Episode\s*(\d+)/);
            if (episodeMatch) {
                const episodeNumber = parseInt(episodeMatch[1] || episodeMatch[2] || episodeMatch[3]);
                if (!isNaN(episodeNumber) && !episodeSet.has(episodeNumber)) {
                    episodeSet.add(episodeNumber);
                    episodeObjects.push({
                        episode: episodeNumber,
                        fileUrl: file.url,
                        fileName: file.name
                    });
                }
            }
        });
        
        return episodeObjects;

    } catch (error) {
        console.log('[JIMAKU][GetEpisodes] Error: ' + error.message);
        return [];
    }
}

/**
 * Gets the subtitle URL for a specific episode
 * @param {number} anilistId The AniList ID of the anime
 * @param {number} episodeNr The episode number
 * @returns {string|null} The URL to the subtitle file or null if not found
 */
function GetSubtitles(anilistId, episodeNr) {
    if (
        anilistId == null ||
        isNaN(parseInt(anilistId)) ||
        episodeNr == null ||
        isNaN(parseInt(episodeNr))
    ) {
        return null;
    }

    // This is an asynchronous operation but needs to be synchronous to maintain the same function signature
    // So we'll return a URL that can be used to fetch the subtitles later
    // This is a workaround - ideally this would be an async function
    return `https://jimaku.app/api/proxy/subtitles?anilist_id=${anilistId}&episode=${episodeNr}`;
}
