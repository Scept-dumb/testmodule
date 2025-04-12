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
        console.log(`Searching for anime with keyword: ${keyword}`);
        const response = await fetch(`${SEARCH_URL}${encodeURI(keyword)}`);
        
        if (!response.ok) {
            throw new Error(`Search request failed with status: ${response.status}`);
        }
        
        const html = await response.text();

        // Validate we have HTML to parse
        if (!html || html.length === 0) {
            throw new Error("Received empty HTML response");
        }

        const json = getNextData(html);
        if (json == null) throw new Error('Error parsing NEXT_DATA json');

        const data = json?.props?.pageProps?.data;
        if(data == null) throw new Error('Error obtaining data from page props');

        // Get AniList IDs with subtitles from Jimaku
        console.log("Fetching available anime from Jimaku...");
        const animesWithSubtitles = await GetAnimes();
        console.log(`Found ${animesWithSubtitles.length} anime with subtitles`);
        
        // Ensure data is iterable
        if (!Array.isArray(data)) {
            console.log("Data is not an array, converting to array");
            // If data is not an array, try to convert it or create empty array
            data = Array.isArray(data) ? data : (data ? [data] : []);
        }

        for(let entry of data) {
            try {
                // Defensive programming: check if entry and entry.mappings exist
                if (!entry || !entry.mappings) {
                    console.log("Skipping entry with missing data");
                    continue;
                }
                
                const anilistId = entry.mappings.anilist;
                
                if (!anilistId || !animesWithSubtitles.includes(parseInt(anilistId))) {
                    continue;
                }

                // Ensure required properties exist
                if (!entry.title || !entry.posterImage || !entry.link) {
                    console.log(`Skipping entry missing required properties: ${entry.title}`);
                    continue;
                }

                shows.push({
                    title: entry.title,
                    image: entry.posterImage.original || entry.posterImage,
                    href: ANIME_URL + entry.link
                });
            } catch (entryError) {
                console.log(`Error processing entry: ${entryError.message}`);
                // Continue to the next entry instead of failing the whole function
                continue;
            }
        }

        console.log(`Found ${shows.length} shows with subtitles`);
        return JSON.stringify(shows);
    } catch (error) {
        console.log('Search error: ' + (error.message || error));
        return JSON.stringify([]);
    }
}

/**
 * Extracts the details (description, aliases, airdate) from the given url
 * @param {string} url The id required to fetch the details
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the details in the format: `[{"description": "Description", "aliases": "Aliases", "airdate": "Airdate"}]`
 */
async function extractDetails(url) {
    try {
        console.log(`Extracting details from: ${url}`);
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Details request failed with status: ${response.status}`);
        }
        
        const html = await response.text();
        
        if (!html || html.length === 0) {
            throw new Error("Received empty HTML response for details");
        }

        const json = getNextData(html);
        if (json == null) throw new Error('Error parsing NEXT_DATA json for details');

        const data = json?.props?.pageProps?.data;
        if(data == null) throw new Error('Error obtaining data from details page props');

        let aliasArray = data?.synonyms || [];
        if(aliasArray.length > 5) {
            aliasArray = aliasArray.slice(0, 5);
        }
        const aliases = aliasArray.join(', ');

        const details = {
            description: data?.synopsys || 'No description available',
            aliases: aliases || 'No aliases available',
            airdate: (data?.animeSeason?.season || 'Unknown') + ' ' + (data?.animeSeason?.year || '')
        };

        return JSON.stringify([details]);
    } catch (error) {
        console.log('Details error: ' + (error.message || error));
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
        console.log(`Extracting episodes from: ${url}`);
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Episodes request failed with status: ${response.status}`);
        }
        
        const html = await response.text();
        
        if (!html || html.length === 0) {
            throw new Error("Received empty HTML response for episodes");
        }
        
        var episodes = [];

        const json = getNextData(html);
        if (json == null) throw new Error('Error parsing NEXT_DATA json for episodes');

        // Safely access nested properties
        const origin = json?.props?.pageProps?.data?._id;
        if (!origin) throw new Error('Could not find origin ID');
        
        const anilistId = json?.props?.pageProps?.data?.mappings?.anilist;
        if (!anilistId) throw new Error('Could not find AniList ID');

        const episodesList = json?.props?.pageProps?.data?.ep;
        if(!episodesList || !Array.isArray(episodesList)) {
            throw new Error('Error obtaining episodes list or list is not an array');
        }

        // Get episodes with subtitles from Jimaku
        console.log(`Fetching subtitle information for AniList ID: ${anilistId}`);
        const episodesWithSubtitlesJson = await GetEpisodes(anilistId);
        console.log(`Found ${episodesWithSubtitlesJson.length} episodes with subtitles`);
        
        const episodesWithSubtitles = episodesWithSubtitlesJson.map(entry => entry?.episode);

        for(let i=1, len=episodesList.length; i<=len; i++) {
            if (!episodesWithSubtitles.includes(i)) {
                continue;
            }

            // Make sure episode data exists in array
            if (!episodesList[i]) {
                console.log(`Episode data missing for episode ${i}`);
                continue;
            }

            let episodeUrl = `${BASE_URL}${episodesList[i]}?origin=${origin}`;

            episodes.push({
                href: episodeUrl,
                number: i
            });
        }

        console.log(`Returning ${episodes.length} episodes`);
        return JSON.stringify(episodes);
    } catch (error) {
        console.log('Episodes error: ' + (error.message || error));
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
        console.log(`Extracting stream URL from: ${url}`);
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Stream request failed with status: ${response.status}`);
        }
        
        const html = await response.text();
        
        if (!html || html.length === 0) {
            throw new Error("Received empty HTML response for stream");
        }

        const json = getNextData(html);
        if (json == null) throw new Error('Error parsing NEXT_DATA json for stream');

        const streamUrl = json?.props?.pageProps?.episode?.streamLink;
        if (!streamUrl) {
            throw new Error('Stream URL not found in page data');
        }
        
        const anilistId = json?.props?.pageProps?.animeData?.mappings?.anilist;
        if (!anilistId) {
            throw new Error('AniList ID not found in page data');
        }
        
        const episodeNumber = json?.props?.pageProps?.episode?.number;
        if (!episodeNumber) {
            throw new Error('Episode number not found in page data');
        }
        
        console.log(`Getting subtitles for AniList ID: ${anilistId}, Episode: ${episodeNumber}`);
        const subtitleUrl = await GetSubtitles(anilistId, episodeNumber);
        
        return JSON.stringify({ 
            stream: streamUrl, 
            subtitles: subtitleUrl 
        });
    } catch (error) {
        console.log('Stream error: ' + (error.message || error));
        return JSON.stringify({ 
            stream: null, 
            subtitles: null 
        });
    }
}

function getNextData(html) {
    try {
        if (!html || typeof html !== 'string') {
            console.log('Invalid HTML passed to getNextData');
            return null;
        }
        
        const trimmedHtml = trimHtml(html, '__NEXT_DATA__', '</script>');
        if (!trimmedHtml) {
            console.log('Could not find __NEXT_DATA__ in HTML');
            return null;
        }
        
        const jsonString = trimmedHtml.slice(39);
        if (!jsonString) {
            console.log('Empty JSON string after trimming');
            return null;
        }

        return JSON.parse(jsonString);
    } catch (e) {
        console.log('Error in getNextData: ' + (e.message || e));
        return null;
    }
}

// Trims around the content, leaving only the area between the start and end string
function trimHtml(html, startString, endString) {
    try {
        const startIndex = html.indexOf(startString);
        if (startIndex === -1) {
            console.log(`Start string '${startString}' not found in HTML`);
            return '';
        }
        
        const endIndex = html.indexOf(endString, startIndex);
        if (endIndex === -1) {
            console.log(`End string '${endString}' not found in HTML after start string`);
            return '';
        }
        
        return html.substring(startIndex, endIndex);
    } catch (e) {
        console.log('Error in trimHtml: ' + (e.message || e));
        return '';
    }
}

/**
 * Gets a list of anime with subtitles from the Jimaku API
 * @returns {Promise<Array<number>>} A promise that resolves with an array of AniList IDs
 */
async function GetAnimes() {
    const API_KEY = 'AAAAAAAABlkuAS5Gu5CmdaJFx5GDWXpl5TGqDsn00SOfknKmwQMPEko-1w';
    const SEARCH_URL = 'https://jimaku.app/api/entries/search?anime=true';

    try {
        console.log('Fetching anime list from Jimaku API');
        const response = await fetch(SEARCH_URL, {
            method: 'GET',
            headers: {
                'Authorization': API_KEY
            }
        });

        if (!response.ok) {
            throw new Error(`Jimaku API request failed with status: ${response.status}`);
        }

        const data = await response.json();
        
        if (!Array.isArray(data)) {
            console.log('Jimaku API did not return an array');
            return [];
        }
        
        // Filter out entries without AniList IDs and convert to numbers
        const anilistIds = data
            .filter(entry => entry && entry.anilist_id !== null && entry.anilist_id !== undefined)
            .map(entry => parseInt(entry.anilist_id))
            .filter(id => !isNaN(id));
            
        console.log(`Found ${anilistIds.length} anime with AniList IDs`);
        return anilistIds;
    } catch (error) {
        console.log('[JIMAKU][GetAnimes] Error: ' + (error.message || error));
        // Return empty array on error to prevent crashing
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
        console.log('Invalid AniList ID provided to GetEpisodes');
        return [];
    }

    const API_KEY = 'AAAAAAAABlkuAS5Gu5CmdaJFx5GDWXpl5TGqDsn00SOfknKmwQMPEko-1w';
    const SEARCH_URL = `https://jimaku.app/api/entries/search?anime=true&anilist_id=${anilistId}`;

    try {
        console.log(`Fetching episodes for AniList ID: ${anilistId}`);
        const response = await fetch(SEARCH_URL, {
            method: 'GET',
            headers: {
                'Authorization': API_KEY
            }
        });

        if (!response.ok) {
            throw new Error(`Jimaku API request failed with status: ${response.status}`);
        }

        const entries = await response.json();
        
        if (!Array.isArray(entries) || entries.length === 0) {
            console.log(`No entries found for AniList ID: ${anilistId}`);
            return [];
        }

        // Get the entry ID to fetch its files
        const entryId = entries[0].id;
        if (!entryId) {
            throw new Error('Entry ID is missing');
        }
        
        const filesUrl = `https://jimaku.app/api/entries/${entryId}/files`;
        console.log(`Fetching files from: ${filesUrl}`);
        
        const filesResponse = await fetch(filesUrl, {
            method: 'GET',
            headers: {
                'Authorization': API_KEY
            }
        });

        if (!filesResponse.ok) {
            throw new Error(`Jimaku Files API request failed with status: ${filesResponse.status}`);
        }

        const files = await filesResponse.json();
        
        if (!Array.isArray(files)) {
            console.log(`Files response is not an array for entry ID: ${entryId}`);
            return [];
        }
        
        // Process files to extract episode numbers
        const episodeObjects = [];
        const episodeRegex = /[Ee]p(?:isode)?[\s._-]*(\d+)|[Ee](\d+)|(?:^|\D)(\d+)(?:\D|$)/;
        const processedEpisodes = new Set();
        
        for (const file of files) {
            if (!file || !file.name || !file.url) {
                console.log('Skipping file with missing data');
                continue;
            }
            
            const match = file.name.match(episodeRegex);
            if (match) {
                const episodeNum = parseInt(match[1] || match[2] || match[3]);
                if (!isNaN(episodeNum) && !processedEpisodes.has(episodeNum)) {
                    processedEpisodes.add(episodeNum);
                    episodeObjects.push({
                        episode: episodeNum,
                        url: file.url,
                        filename: file.name
                    });
                }
            }
        }
        
        console.log(`Found ${episodeObjects.length} episodes with subtitles`);
        return episodeObjects;
    } catch (error) {
        console.log('[JIMAKU][GetEpisodes] Error: ' + (error.message || error));
        return [];
    }
}

/**
 * Gets the subtitle URL for a specific episode
 * @param {number} anilistId The AniList ID of the anime
 * @param {number} episodeNr The episode number
 * @returns {Promise<string|null>} A promise that resolves with the subtitle URL or null if not found
 */
async function GetSubtitles(anilistId, episodeNr) {
    if (
        anilistId == null ||
        isNaN(parseInt(anilistId)) ||
        episodeNr == null ||
        isNaN(parseInt(episodeNr))
    ) {
        console.log('Invalid parameters provided to GetSubtitles');
        return null;
    }

    try {
        console.log(`Getting subtitles for AniList ID: ${anilistId}, Episode: ${episodeNr}`);
        const episodesData = await GetEpisodes(anilistId);
        
        if (!Array.isArray(episodesData) || episodesData.length === 0) {
            console.log('No episodes data available');
            return null;
        }
        
        const episode = episodesData.find(ep => ep && ep.episode === parseInt(episodeNr));
        
        if (episode && episode.url) {
            console.log(`Found subtitle URL: ${episode.url}`);
            return episode.url;
        }
        
        console.log(`No subtitle found for episode ${episodeNr}`);
        return null;
    } catch (error) {
        console.log('[JIMAKU][GetSubtitles] Error: ' + (error.message || error));
        return null;
    }
}
