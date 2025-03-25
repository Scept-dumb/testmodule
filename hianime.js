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
    }    
}

/* Updated extractStreamUrl to fetch subtitles from the external API.
   Note: This function now accepts animeName and episodeNumber as additional parameters.
   It first fetches the streaming source from the existing API then uses the jimaku API to search for subtitles
   and fetch the corresponding .srt file.
*/
async function extractStreamUrl(url, animeName, episodeNumber) {
    try {
        const match = url.match(/https:\/\/aniwatchtv\.to\/(.+)$/);
        const encodedID = match[1];
        const response = await fetch(`https://aniwatch-api-one-rosy.vercel.app/aniwatch/episode-srcs?id=${encodedID}&server=vidstreaming&category=sub`);
        const data = JSON.parse(response);
       
        // Get the HLS stream source as before.
        const hlsSource = data.sources.find(source => source.type === 'hls');
        
        // Use the jimaku API to search for subtitle entries using the anime name and episode number.
        const searchUrl = 'https://jimaku.cc/api/entries/search';
        const searchResponse = await fetch(searchUrl, {
            headers: {
                Authorization: 'AAAAAAAABlkuAS5Gu5CmdaJFx5GDWXpl5TGqDsn00SOfknKmwQMPEko-1w'
            },
            // Pass search parameters in the URL (assuming the API supports query params such as "name" and "episode")
            method: 'GET'
        });
        const searchData = await searchResponse.json();
        
        // Find a matching subtitle entry. (This example assumes that the searchData contains entries 
        // with an "english_name" or "name" field and that you can match on the animeName and episodeNumber.)
        const subtitleEntry = searchData.find(entry => {
            // Compare the provided animeName with the entry's english_name or name.
            const entryName = entry.english_name || entry.name;
            return entryName && entryName.toLowerCase().includes(animeName.toLowerCase());
        });
        
        let subtitles = null;
        if (subtitleEntry) {
            // Fetch the .srt file using the subtitle entry id.
            const fileUrl = `https://jimaku.cc/api/entries/${subtitleEntry.id}/files`;
            const fileResponse = await fetch(fileUrl, {
                headers: {
                    Authorization: 'AAAAAAAABlkuAS5Gu5CmdaJFx5GDWXpl5TGqDsn00SOfknKmwQMPEko-1w'
                }
            });
            const fileData = await fileResponse.json();
            // Assuming fileData returns an object with the URL to the .srt file
            subtitles = fileData.file || null;
        }
       
        const result = {
            stream: hlsSource ? hlsSource.url : null,
            subtitles: subtitles
        };
       
        return JSON.stringify(result);
    } catch (error) {
        console.log('Fetch error:', error);
        return JSON.stringify({ stream: null, subtitles: null });
    }
}
