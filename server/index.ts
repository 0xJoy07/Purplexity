import express from "express"
import { tavily } from "@tavily/core"
import { PROMPT_TEMPLATE, SYSTEM_PROMPT } from "./prompt";
import OpenAI from 'openai'

const client = tavily({ apiKey: process.env.TAVILY_API_KEY });

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
    const openai = new OpenAI({
        apiKey: process.env.NVIDIA_API_KEY,
        baseURL: 'https://integrate.api.nvidia.com/v1',
    })

    const completion = await openai.chat.completions.create({
        model: "nvidia/nemotron-3-ultra-550b-a55b",
        messages: [{
            "role":"user",
            "content":prompt 
        }],
        temperature: 1,
        top_p: 0.95,
        max_tokens: 16384,
        reasoning_budget: 16384,
        chat_template_kwargs: {"enable_thinking":true},
        stream: true
    })



    /* Also stream back the sources and the follow up questions (which we can get from another parallel LLM call) */

    


    
})

app.listen(3000)