require('dotenv').config({ path: '.env.local' });


async function getTables() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/?apikey=' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const res = await fetch(url);
    const data = await res.json();
    require('fs').writeFileSync('openapi.json', JSON.stringify(data, null, 2));
}

getTables();
