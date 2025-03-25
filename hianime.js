async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const responseText = await fetch(`https://aniwatch-api-one-rosy.vercel.app/aniwatch/search?keyword=${encodedKeyword}`);
        const data = JSON.parse(responseText);
        
        const transformedResults = data.animes.map(anime => ({
            title: anime.name,
            image: anime.img,
            href: `https://aniwatchtv.to/${anime.id}`
        }));
        
        return JSON.stringify(transformedResults);
        
    } catch (error) {
        console.log('Fetch error:', error);
        return JSON.stringify([{ title: 'Error', image: '', href: '' }]);
    }
}

async function extractDetails(url) {
    try {
        const match = url.match(/https:\/\/aniwatchtv\.to\/(.+)$/);
        const encodedID = match[1];
        const response = await fetch(`https://aniwatch-api-one-rosy.vercel.app/aniwatch/anime/${encodedID}`);
        const data = JSON.parse(response);
        
        const animeInfo = data.info;
        
        const transformedResults = [{
            description: animeInfo.description || 'No description available',
            aliases: `Duration: ${animeInfo.duration || 'Unknown'}`,
            airdate: `Aired: ${animeInfo.aired_in || 'Unknown'}`
        }];
        
        return JSON.stringify(transformedResults);
    } catch (error) {
        console.log('Details error:', error);
        return JSON.stringify([{
        description: 'Error loading description',
        aliases: 'Duration: Unknown',
        airdate: 'Aired: Unknown'
        }]);
  }
}

async function extractEpisodes(url) {
    try {
        const match = url.match(/https:\/\/aniwatchtv\.to\/(.+)$/);
        const encodedID = match[1];
        const response = await fetch(`https://aniwatch-api-one-rosy.vercel.app/aniwatch/episodes/${encodedID}`);
        const data = JSON.parse(response);

        const transformedResults = data.episodes.map(episode => ({
            href: `https://aniwatchtv.to/${episode.episodeId}`,
            number: episode.episodeNo
        }));
        
        return JSON.stringify(transformedResults);
        
    } catch (error) {
        console.log('Fetch error:', error);
        return JSON.stringify([]);
    }    
}

async function extractStreamUrl(url) {
    try {
        // Validate URL
        const match = url.match(/https:\/\/aniwatchtv\.to\/(.+)$/);
        if (!match) {
            console.log('Invalid URL format');
            return JSON.stringify({ stream: null, subtitles: null, error: 'Invalid URL' });
        }
        const encodedID = match[1];

        // Fetch episode sources
        const sourcesResponse = await fetch(`https://aniwatch-api-one-rosy.vercel.app/aniwatch/episode-srcs?id=${encodedID}&server=vidstreaming&category=sub`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: 10000 // 10 second timeout
        });

        // Check if response is ok
        if (!sourcesResponse.ok) {
            console.log(`HTTP error! status: ${sourcesResponse.status}`);
            return JSON.stringify({ 
                stream: null, 
                subtitles: null, 
                error: `HTTP error: ${sourcesResponse.status}` 
            });
        }

        const data = await sourcesResponse.json();

        // Validate data
        if (!data || !data.sources) {
            console.log('No sources found in response');
            return JSON.stringify({ stream: null, subtitles: null, error: 'No sources found' });
        }

        const hlsSource = data.sources.find(source => source.type === 'hls');
        
        // If no HLS source, return early
        if (!hlsSource) {
            console.log('No HLS source found');
            return JSON.stringify({ stream: null, subtitles: null, error: 'No HLS source' });
        }

        // Construct a base name for searching
        const searchName = data.info?.name || '';

        // Search Jimaku API with more robust error handling
        let subtitles = null;
        try {
            const searchResponse = await fetch('https://jimaku.cc/api/entries/search', {
                method: 'GET',
                headers: {
                    'Authorization': 'AAAAAAAABlkuAS5Gu5CmdaJFx5GDWXpl5TGqDsn00SOfknKmwQMPEko-1w',
                    'Content-Type': 'application/json'
                },
                timeout: 10000 // 10 second timeout
            });

            if (!searchResponse.ok) {
                console.log(`Jimaku search error: ${searchResponse.status}`);
                throw new Error(`Jimaku search HTTP error: ${searchResponse.status}`);
            }

            const searchData = await searchResponse.json();
            
            // More flexible matching
            const matchedAnime = searchData.find(anime => 
                anime.english_name.toLowerCase().includes(searchName.toLowerCase()) || 
                anime.name.toLowerCase().includes(searchName.toLowerCase()) ||
                searchName.toLowerCase().includes(anime.name.toLowerCase())
            );

            if (matchedAnime) {
                const filesResponse = await fetch(`https://jimaku.cc/api/entries/${matchedAnime.id}/files`, {
                    method: 'GET',
                    headers: {
                        'Authorization': 'AAAAAAAABlkuAS5Gu5CmdaJFx5GDWXpl5TGqDsn00SOfknKmwQMPEko-1w',
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000 // 10 second timeout
                });

                if (!filesResponse.ok) {
                    console.log(`Jimaku files error: ${filesResponse.status}`);
                    throw new Error(`Jimaku files HTTP error: ${filesResponse.status}`);
                }

                const filesData = await filesResponse.json();
                
                // More flexible subtitle matching
                const episodeSubtitle = filesData.find(file => 
                    (file.episode === data.info.currentEpisode || 
                     file.episode.toString() === data.info.currentEpisode) && 
                    file.type === 'srt' && 
                    file.language === 'en'
                );
                
                subtitles = episodeSubtitle ? episodeSubtitle.url : null;
            }
        } catch (subtitleError) {
            console.log('Subtitle fetch error:', subtitleError);
            // Continue with stream even if subtitle fetch fails
        }
        
        const result = {
            stream: hlsSource.url,
            subtitles: subtitles,
            error: subtitles ? null : 'No subtitles found'
        };
        
        return JSON.stringify(result);
    } catch (error) {
        console.log('Complete extraction error:', error);
        return JSON.stringify({ 
            stream: null, 
            subtitles: null, 
            error: error.message || 'Unknown error occurred' 
        });
    }
}
