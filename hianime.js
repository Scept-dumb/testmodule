async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const responseText = await fetch(`https://aniwatch-api-one-rosy.vercel.app/aniwatch/search?keyword=${encodedKeyword}`);
        const data = JSON.parse(responseText);
        
        const transformedResults = data.animes.map(anime => {
            // Optionally, store the title globally for later use.
            window.animeTitle = anime.name;
            return {
                title: anime.name,
                image: anime.img,
                href: `https://aniwatchtv.to/${anime.id}`
            };
        });
        
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

        const transformedResults = data.episodes.map(episode => {
            // Optionally, store the episode number globally for later use.
            window.episodeNumber = episode.episodeNo;
            return {
                href: `https://aniwatchtv.to/${episode.episodeId}`,
                number: episode.episodeNo
            };
        });
        
        return JSON.stringify(transformedResults);
        
    } catch (error) {
        console.log('Fetch error:', error);
    }    
}

/* Updated extractStreamUrl
   - This function no longer accepts extra parameters.
   - Instead, it uses the globally stored values:
       • window.animeTitle (which should be set using title: anime.name from searchResults)
       • window.episodeNumber (which should be set using number: episode.episodeNo from extractEpisodes)
   - It then calls the subtitle API (jimaku.cc) to fetch the corresponding .srt file.
*/
async function extractStreamUrl(url) {
    try {
       const match = url.match(/https:\/\/aniwatchtv\.to\/(.+)$/);
       const encodedID = match[1];
       const response = await fetch(`https://aniwatch-api-one-rosy.vercel.app/aniwatch/episode-srcs?id=${encodedID}&server=vidstreaming&category=sub`);
       const data = JSON.parse(response);
       
       // Get the HLS stream source as before.
       const hlsSource = data.sources.find(source => source.type === 'hls');
       
       // Use globally stored anime title and episode number.
       const animeName = window.animeTitle;
       const episodeNumber = window.episodeNumber;
       
       // Call the jimaku API to search for subtitles.
       const searchUrl = 'https://jimaku.cc/api/entries/search';
       const searchResponse = await fetch(searchUrl, {
            headers: {
                Authorization: 'AAAAAAAABlkuAS5Gu5CmdaJFx5GDWXpl5TGqDsn00SOfknKmwQMPEko-1w'
            },
            method: 'GET'
       });
       const searchData = await searchResponse.json();
       
       // Find a matching subtitle entry.
       const subtitleEntry = searchData.find(entry => {
            const entryName = entry.english_name || entry.name;
            return entryName && entryName.toLowerCase().includes(animeName.toLowerCase());
       });
       
       let subtitles = null;
       if (subtitleEntry) {
           // Fetch the subtitle file using the subtitle entry id.
           const fileUrl = `https://jimaku.cc/api/entries/${subtitleEntry.id}/files`;
           const fileResponse = await fetch(fileUrl, {
                headers: {
                    Authorization: 'AAAAAAAABlkuAS5Gu5CmdaJFx5GDWXpl5TGqDsn00SOfknKmwQMPEko-1w'
                }
           });
           const fileData = await fileResponse.json();
           // Assuming fileData returns an object with a "file" property containing the .srt file URL.
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
