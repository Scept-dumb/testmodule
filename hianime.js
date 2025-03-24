// Helper function to search for the anime entry on Jimaku
async function searchJimakuEntry(animeTitle) {
    try {
        const response = await fetch(`https://jimaku.cc/api/entries/search?query=${encodeURIComponent(animeTitle)}`, {
            headers: {
                'Authorization': 'AAAAAAAABlkuAS5Gu5CmdaJFx5GDWXpl5TGqDsn00SOfknKmwQMPEko-1w', // Replace with your actual API key
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to search for anime entry');
        }
        
        const entries = await response.json();
        
        // Return the first matching entry
        return entries.length > 0 ? entries[0] : null;
    } catch (error) {
        console.error('Jimaku search error:', error);
        return null;
    }
}

// Helper function to get subtitle files for a specific episode
async function getJimakuSubtitles(entryId, episodeNumber) {
    try {
        const response = await fetch(`https://jimaku.cc/api/entries/${entryId}/files?episode=${episodeNumber}`, {
            headers: {
                'Authorization': 'AAAAAAAABlkuAS5Gu5CmdaJFx5GDWXpl5TGqDsn00SOfknKmwQMPEko-1w', // Replace with your actual API key
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to retrieve subtitle files');
        }
        
        const files = await response.json();
        
        // Filter and prioritize subtitle files
        const subtitleFiles = files.filter(file => {
            const lowerName = file.name.toLowerCase();
            return lowerName.endsWith('.srt') || 
                   lowerName.endsWith('.ass') || 
                   lowerName.endsWith('.vtt');
        });
        
        // Return the first subtitle file URL if found
        return subtitleFiles.length > 0 ? subtitleFiles[0].url : null;
    } catch (error) {
        console.error('Jimaku subtitle retrieval error:', error);
        return null;
    }
}

// Modified extractStreamUrl function
async function extractStreamUrl(url) {
    try {
        // Existing code to get stream information
        const match = url.match(/https:\/\/aniwatchtv\.to\/(.+)$/);
        const encodedID = match[1];
        
        // Get the stream source
        const response = await fetch(`https://aniwatch-api-one-rosy.vercel.app/aniwatch/episode-srcs?id=${encodedID}&server=vidstreaming&category=sub`);
        const data = JSON.parse(response);
        
        // Get the HLS source
        const hlsSource = data.sources.find(source => source.type === 'hls');
        
        // Get episode details to extract anime title and episode number
        const episodeResponse = await fetch(`https://aniwatch-api-one-rosy.vercel.app/aniwatch/episode-detail?id=${encodedID}`);
        const episodeData = JSON.parse(episodeResponse);
        const animeId = episodeData.anime_id;
        const episodeNumber = episodeData.number;
        
        // Get anime details to get the title
        const animeResponse = await fetch(`https://aniwatch-api-one-rosy.vercel.app/aniwatch/anime/${animeId}`);
        const animeData = JSON.parse(animeResponse);
        const animeTitle = animeData.info.name;
        
        // Search for the anime entry on Jimaku
        const jimakuEntry = await searchJimakuEntry(animeTitle);
        
        // Get subtitles for the specific episode
        let subtitles = null;
        if (jimakuEntry) {
            subtitles = await getJimakuSubtitles(jimakuEntry.id, episodeNumber);
        }
        
        // Fallback to original subtitle track if Jimaku subtitles not found
        const subtitleTrack = data.tracks.find(track => track.label === 'English' && track.kind === 'captions');
        
        const result = {
            stream: hlsSource ? hlsSource.url : null,
            subtitles: subtitles || (subtitleTrack ? subtitleTrack.file : null),
            subtitleLanguage: subtitles ? 'Japanese' : (subtitleTrack ? 'English' : null)
        };
        
        return JSON.stringify(result);
    } catch (error) {
        console.log('Fetch error:', error);
        return JSON.stringify({ stream: null, subtitles: null, subtitleLanguage: null });
    }
}
