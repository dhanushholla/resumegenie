import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import mammoth from 'mammoth';
import pdfToText from 'react-pdftotext';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import SkillsChart from './SkillChart';

const Panel = () => {
    const [file, setFile] = useState(null);
    const [resumeData, setResumeData] = useState('');
    const [question, setQuestion] = useState('');
    const [JD, setJD] = useState('');
    const [answer, setAnswer] = useState('');
    const [JDanswer, setJDAnswer] = useState('');
    const [jsonPreview, setJsonPreview] = useState('');
    const [generativeAI, setGenerativeAI] = useState(null);
    const [loading, setLoading] = useState(false);
    const [flag, setFlag] = useState(false);
    const [uploadToggle, setToggle] = useState(false);
    const [skillsData,setskillsData]=useState(null);
    const fileref = useRef();

    useEffect(() => {
        const initializeGenerativeAI = async () => {
            try {
                const apiKey = import.meta.env.VITE_APIKEY;
                const ai = new GoogleGenAI({ apiKey });
                setGenerativeAI(ai);
                console.log('AI initialized successfully with new GoogleGenAI');
            } catch (error) {
                console.error('Error initializing AI:', error);
                toast.error('Failed to initialize AI. Please check your API key and try again.');
            }
        };

        initializeGenerativeAI();
        toast('Welcome to ResumeGenie v1.0! Currently supporting .docx,.txt,.pdf file formats');
        toast('Try out Querying,summarizing,JD profile Matching with your resume!')
    }, []);

    function scrapeJDData(JDanswer) {
        const regex = /\[\s*{(?:[^{}]*"name":\s*".*?"[^{}]*"rating":\s*\d+\s*)+\}\s*(,\s*{(?:[^{}]*"name":\s*".*?"[^{}]*"rating":\s*\d+\s*)})*\s*]/s;
        const match = JDanswer.match(regex);
        if (match) {
            try {
                const jsonString = match[0]; 
                const jsonData = JSON.parse(jsonString);
                return jsonData;
            } catch (error) {
                console.error("Failed to parse JSON:", error);
            }
        } else {
            console.error("No valid JSON pattern found in JDanswer.");
        }
        return null;
    }

    const handleFileChange = (event) => {
        resetFields();
        setFile(event.target.files[0]);
    };

    const handleUpload = async () => {
        if (!file) return;

        setLoading(true);
        setToggle(true);
        let resumeText = '';
        
        const fileReader = new FileReader();
        fileReader.onload = async (e) => {
            try {
                const content = e.target.result;

                // Determine file type and extract content
                const fileType = file.type;
                if (fileType === 'application/pdf') {
                    resumeText = await extractTextFromPDF(file);
                } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                    resumeText = await extractTextFromDOCX(content);
                } else if (fileType === 'text/plain') {
                    resumeText = content; // For plain text
                } else {
                    console.error('Unsupported file type');
                    toast.error('Unsupported file type');
                    setLoading(false);
                    return;
                }

                setResumeData(resumeText);
                await parseResume(resumeText);
                setFlag(true);
                toast.success('Resume Uploaded!');
            } catch (error) {
                console.error('Error processing file:', error);
                toast.error('Error processing file. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fileReader.readAsArrayBuffer(file);
    };

    const extractTextFromPDF = async (fileC)=>{
        try {
            let res = await pdfToText(fileC);
            return res;
        } catch (err) {
            console.error('PDF processing error:', err);
            toast.error('Issue with processing PDF file 🙁, please try again later!');
            return 'pdf data retrieval Error';
        }
    }

    const extractTextFromDOCX = async (content) => {
        try {
            const arrayBuffer = new Uint8Array(content);
            const { value: text } = await mammoth.extractRawText({ arrayBuffer });
            return text;
        } catch (error) {
            console.error('DOCX processing error:', error);
            toast.error('Error processing DOCX file');
            throw error;
        }
    };

    const parseResume = async (resumeText) => {
        if (!generativeAI) return;

        try {
            const response = await generativeAI.models.generateContent({
                model: "gemini-2.0-flash",
                contents: `Extract key information from the following resume:\n\n${resumeText}`
            });
            console.log('Resume parsed successfully');
        } catch (error) {
            console.error('Error parsing resume:', error);
            toast.error('Error parsing resume with AI');
        }
    };

    const handleJDChat = async () => {
        if (!generativeAI) return;
        setLoading(true)
        try {
            const prompt =`
            note no formatting styles or even special character delimiters like #,** etc.. should be there
            Evaluate the provided resume against the given job description with precision and relevance. provide report under 220 words Follow these command parameters:
            1. Categories: Try to create role related categories, Align them with the JD minimum of 7 (e.g., Technical Skills, Soft Skills, Leadership, Accountability, Problem Solving, etc.). Provide numeric ratings from 1 to 10.  
            2. Report Format: Use numbered lists (1, 2, 3, ...) with concise, specific insights. No extra styling or formatting.  
            3. Scope Validation: If the JD content is invalid or unrelated, state: "Out of scope content other than Job Description cannot be processed."
            4. Always provided brief overall review section and rating of the candidate.
            Input:  
            - Resume Data: ${resumeData}  
            - Job Description: ${JD}
            and also provide json data in the format similar as
            json
                [
                    { "name": "category name", "rating": ratingcount },
                    etc....
                ]`
            const response = await generativeAI.models.generateContent({
                model: "gemini-2.0-flash",
                contents: prompt
            });
            setJDAnswer(response.text);
            let res = scrapeJDData(response.text);
            setskillsData(res)
        } catch (error) {
            console.error('Error in JD chat:', error);
            toast.error('Error processing JD analysis');
        }finally {
            setLoading(false);
        }
    };

    const handleChat = async () => {
        if (!generativeAI) return;
        setLoading(true)
        try {
            const prompt = `As an experienced recruiter, answer the following question based on this resume data:\n\n${resumeData}\n\nQuestion: ${question}, in response, if anything asked irrelavant or out of scope then said it is not in scope and say try to ask question related to this resume and insist that strictly`;
            const response = await generativeAI.models.generateContent({
                model: "gemini-2.0-flash",
                contents: prompt
            });
            setAnswer(response.text);
        } catch (error) {
            console.error('Error in chat:', error);
            toast.error('Error processing query');
        }finally {
            setLoading(false);
        }
    };
    
    const summarize = async () => {
        if (!generativeAI) return;
        setLoading(true);
        try {
            const prompt = `As an experienced recruiter and content curator, answer the following question based on this resume data:\n\n${resumeData}\n\n Question: summarize the whole resume with necessary key details under 250 words with all sections in an ATS parsable text content (preferably plain text)`;
            const response = await generativeAI.models.generateContent({
                model: "gemini-2.0-flash",
                contents: prompt
            });
            toast.success('Summarized!');
            setAnswer(response.text);
        } catch (error) {
            console.error('Error in summarization:', error);
            toast.error('Error generating summary');
        } finally {
            setLoading(false);
        }
    };

    const copyResult = () =>{
        window.navigator.clipboard.writeText(answer);
        toast.success('Result Copied!')
    }
    
    const copyJDResult = () =>{
        window.navigator.clipboard.writeText(JDanswer);
        toast.success('JD Report Copied!')
    }

    const extractJsonFormat = async () => {
        if (!generativeAI || !resumeData) return;

        setLoading(true);
        try {
            const prompt = `Group and categorize each and every aspect of the resume details into a suitable JSON structure based on the following resume:\n\n${resumeData} and each experience should also contain skillset but not categories, also keep a special note that while categorizing the skillset entry individually(outside experience) .. try to group them under respective fields like programming languages,databases,frontend,backend,databases etc.. provide Only high quality json structure as response`;
            const response = await generativeAI.models.generateContent({
                model: "gemini-2.0-flash",
                contents: prompt
            });
            setJsonPreview(response.text);
            window.navigator.clipboard.writeText(response.text);
            toast.success('JSON Copied!');
        } catch (error) {
            console.error('Error extracting JSON format:', error);
            toast.error('Error generating JSON format');
        } finally {
            setLoading(false);
        }
    };

    const resetFields = () => {
        setFile(null);
        setResumeData('');
        setQuestion('');
        setAnswer('');
        setJsonPreview('');
        setFlag(false);
        setToggle(false);
        fileref.current.click();
    };

    return (
    <div className='mx-2 my-2'>
        <ToastContainer/>
        <div className="max-w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="p-4 border border-gray-300 rounded-lg">
                <h1 className="text-2xl font-bold mb-4">ResumeGenie ✨📝</h1>
                <span className='text-gray-600'>{`(ℹ️  Upload resume and start experimenting! 😎)`}</span>
                <input
                    type="file"
                    accept=".docx,.txt,.pdf"
                    onChange={handleFileChange}
                    className="mb-4 border border-gray-300 p-2 rounded w-full"
                    ref={fileref}
                />
                <div className="flex space-x-2 mb-4">
                    <button
                        onClick={handleUpload}
                        className={`bg-blue-500 text-white p-2 rounded ${loading || uploadToggle ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={loading || uploadToggle}
                    >
                        {'Upload Resume'}
                    </button>
                    <button
                            onClick={extractJsonFormat}
                            className={`bg-teal-500 text-white p-2 rounded ${(loading || (file==null) || !uploadToggle) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={loading || file==null || !uploadToggle }
                        >
                            {'Extract & Copy JSON'}
                    </button>
                    <button
                            onClick={summarize}
                            className={`bg-yellow-500 text-white p-2 rounded ${(loading || (file==null) || !uploadToggle) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={loading || file==null || !uploadToggle}
                        >
                            {'Summarize ✍🏻'}
                    </button>
                    <button
                        onClick={resetFields}
                        className={`bg-red-500 text-white p-2 rounded ${(loading || (file==null)|| !uploadToggle) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={loading || file==null || !uploadToggle}
                    >
                        Reset
                    </button>
                </div>

                {flag && (
                    <>
                        {jsonPreview && (
                            <>
                                <h2 className="text-xl mb-2">JSON Preview:</h2>
                                <pre className="border border-gray-300 p-2 rounded whitespace-pre-wrap max-h-96 overflow-y-auto">
                                    {jsonPreview}
                                </pre>
                            </>
                        )}
                    </>
                )}
            </div>
            <div className="p-4 border border-gray-300 rounded-lg">
                <h2 className="text-2xl font-bold mb-4">Shoot Your Questions 🙋🏻‍♂️🚀</h2>
                <span className='text-gray-600'>{`(ℹ️ Ask questions to AI about uploaded resume ⬇️)`}</span>
                <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder='Enter your question'
                    className="mb-6 border border-gray-300 p-2 mt-1 rounded w-full"
                />
                {question.length?<button
                    onClick={handleChat}
                    className={`bg-green-500 text-white p-4 rounded ${loading || file==null|| !uploadToggle? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={loading || file==null|| !uploadToggle}
                >
                    Query it!
                </button>:''}
                {answer.length?<button
                        onClick={copyResult}
                        className={`bg-blue-500 text-white ml-4 p-4 rounded ${loading || file==null|| !uploadToggle ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={loading || file==null|| !uploadToggle}
                    >
                        {'Copy Query Result'}
                    </button>:""}

                {answer && (
                    <>
                        <h2 className="text-xl mb-2 mt-6">Generated Result 💬 :</h2>
                        <p className="border border-gray-300 p-2 whitespace-pre-wrap max-h-96 overflow-y-auto rounded">{answer}</p>
                    </>
                )}
            </div>
            <div className="p-4 border border-gray-300 rounded-lg ">
                <h2 className="text-2xl font-bold mb-4">JD & Resume Match ⚖️💫</h2>
                <span className='text-gray-600'>{`(ℹ️ Paste Job Description & Find out profile insights! ⬇️)`}</span>
                <input
                    type="text"
                    value={JD}
                    onChange={(e) => setJD(e.target.value)}
                    placeholder='Enter your desired job description'
                    className="mb-4 border border-gray-300 p-2 mt-1 rounded w-full"
                />
                {JD.length?<button
                    onClick={handleJDChat}
                    className={`bg-green-500 text-white p-2 rounded mb-4 ${loading || file==null|| !uploadToggle? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={loading || file==null|| !uploadToggle}
                >
                    let's Rate!
                </button>:''}
                {JDanswer.length?<button
                        onClick={copyJDResult}
                        className={`bg-blue-500 text-white ml-4 p-2 rounded ${loading || file==null|| !uploadToggle ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={loading || file==null|| !uploadToggle}
                    >
                        {'Copy JD Match Result'}
                    </button>:""}

                {JDanswer && (
                    <>
                        <h2 className="text-xl mb-2">JD Resume Match Result 📊 :</h2>
                        <div className='p-4 h-72'>
                              <SkillsChart data={skillsData} />
                        </div>
                        <h4>Report:</h4>
                        <p className="border border-gray-300 p-2 whitespace-pre-wrap max-h-44 overflow-y-auto rounded">{JDanswer}</p>
                    </>
                )}
            </div>
        </div>
        <div className='text-center bottom-0 p-1 lg:absolute lg:left-1/2 lg:transform lg:-translate-x-1/2'>
                Made with ❤️ By <a href='https://dhanushholla.vercel.app' className='text-blue-400 hover:underline'>Dhanush Holla ↗</a>
        </div>
        </div>
    );
};

export default Panel;
