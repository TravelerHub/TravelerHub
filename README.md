# Getting started

**Step 1:** Install the [NodeJS and npm](https://nodejs.org/en)

**Step 2:** Install Dependencies

This command will install all the required dependencies listed in the package.json file.
`npm install`

**Step 3:** Create an environment file **.env** in root directory (the same folder of index.html - aka TravelerHub folder), go to database, find the url, key and update the **.env** file.

`VITE_SUPABASE_URL=[url-go-here]

VITE_SUPABASE_ANON_KEY=[key-go-here]`

Make sure your type the same thing otherwise database won't work

I already update .gitignore so you dont accidentally commit our key to public but NEVER commit our key here.

**Step 4:** Start the Server

run this command `npm run dev` and head to http://localhost:5173/ in your browser

**Step 5:** Start working in src folder

We will follow [bulletproof-react](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) structure to keep our code organized, please be mindful to where your code should go :)


## API for Map 
Create a Mapbox Account

Go to Mapbox:

Visit: https://account.mapbox.com/auth/signup/
OR just go to https://www.mapbox.com/ and click "Sign up"


Sign up:

Enter your email address
Create a password
Click "Get started"
Verify your email 



cd frontend
npm install mapbox-gl react-map-gl @mapbox/mapbox-sdk

Open your frontend/.env file
VITE_MAPBOX_TOKEN=pk.your_actual_token_here
