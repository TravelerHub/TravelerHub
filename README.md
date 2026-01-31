# Getting started

## Frontend

**Step 1:** Install the [NodeJS and npm](https://nodejs.org/en)

**Step 2:** Install Dependencies

This command will install all the required dependencies listed in the package.json file.
`npm install`

**Step 3:** Start the Client

run this command `npm run dev` and head to http://localhost:5173/ in your browser

## Backend

**Step 1:** Create an environment file **.env** in backend directory (detail in group)

**Step 2:** Install and activate Vertual environment

Install `python3 -m venv venv`

Activate `source venv/bin/activate`

**Step 3:** Install Dependencies

This command will install all the required dependencies listed in the requirement.txt file.
`pip install -r requirements.txt`

**Step 4:** Start the Server

run this command `uvicorn main:app --reload`

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
