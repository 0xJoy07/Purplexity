import express from "express"
import { tavily } from "@tavily/core"
import { PROMPT_TEMPLATE, SYSTEM_PROMPT } from "./prompt";
import 'dotenv/config';
import OpenAI from 'openai';

// OpenRouter Client Creation
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

const client = tavily({ 
    apiKey: process.env.TAVILY_API_KEY
});
const app = express()

app.post("/purplexity_ask" , async (req,res) => {

    /* Get the query from the User */
    const query = req.body.query;
    /* MAke sure the user has access/credits to hit the endpoint */

    /* Check if we have web search indexed for a similar query */

    /* Web serach to gather resources */
    const webSearchResponse = await client.search("", {
        searchDepth: "advanced"
    });

    const webSearchResults = await webSearchResponse.results;

    /* do some context engineering on the prompt + web search reponses */
    const prompt = PROMPT_TEMPLATE
                        .replace("{{WEB_SEARCH_RESULTS}}" , JSON.stringify(webSearchResults))
                        .replace("{{USER_QUERY}}", query)

    /* Hit the LLM and stream back the response */
    const completion = await openrouter.chat.completions.create({
        model: "openrouter/free",
        messages: [{ 
            role: 'user',
            content: "{SYSTEM_PROMPT}"
         }],
    });



    /* Also stream back the sources and the follow up questions (which we can get from another parallel LLM call) */

    


    
})

app.listen(3000)