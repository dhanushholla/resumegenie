import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Panel = () => {
    const [file, setFile] = useState(null);
    const [resumeData, setResumeData] = useState('');
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [jsonPreview, setJsonPreview] = useState('');
    const [generativeAI, setGenerativeAI] = useState(null);
    const [model, setModel] = useState(null);
    const [loading, setLoading] = useState(false);
    const [flag, setFlag] = useState(false);
    const [uploadToggle, setToggle] = useState(false);
    const fileref = useRef();

    useEffect(() => {
        const initializeGenerativeAI = async () => {
            const apiKey = import.meta.env.VITE_APIKEY;
            const aiInstance = new GoogleGenerativeAI(apiKey);
            const generativeModel = aiInstance.getGenerativeModel({ model: "gemini-1.5-flash" });
            setGenerativeAI(aiInstance);
            setModel(generativeModel);
        };

        initializeGenerativeAI();
    }, []);

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
            const content = e.target.result;

            // Determine file type and extract content
            const fileType = file.type;
            if (fileType === 'application/pdf') {
                resumeText = await extractTextFromPDF(content);
            } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                resumeText = await extractTextFromDOCX(content);
            } else if (fileType === 'text/plain') {
                resumeText = content; // For plain text
            } else {
                console.error('Unsupported file type');
                setLoading(false);
                return;
            }

            setResumeData(resumeText);
            await parseResume(resumeText);
            setFlag(true);
            setLoading(false);
        };

        fileReader.readAsArrayBuffer(file);
        toast('Resume Uploaded!')
    };

    const extractTextFromPDF = async (content) => {
        const pdfData = new Uint8Array(content);
        const pdf = await pdfjsLib.getDocument(pdfData).promise;
        const numPages = pdf.numPages;
        let textContent = '';

        for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const text = await page.getTextContent();
            textContent += text.items.map(item => item.str).join(' ') + '\n';
        }
        return textContent;
    };

    const extractTextFromDOCX = async (content) => {
        const arrayBuffer = new Uint8Array(content);
        const { value: text } = await mammoth.extractRawText({ arrayBuffer });
        return text;
    };

    const parseResume = async (resumeText) => {
        if (!model) return;

        try {
            const prompt = `Extract key information from the following resume:\n\n${resumeText}`;
            const result = await model.generateContent([prompt]);
            console.log('Parsed Resume Response:', result);
        } catch (error) {
            console.error('Error parsing resume:', error);
        }
    };

    const handleChat = async () => {
        if (!model) return;
        setLoading(true)
        try {
            const prompt = `As an experienced recruiter, answer the following question based on this resume data:\n\n${resumeData}\n\nQuestion: ${question}, in response, if anything asked irrelavant or out of scope then said it is not in scope and say try to ask question related to this resume and insist that strictly`;
            const result = await model.generateContent([prompt]);
            setAnswer(result.response.text());
        } catch (error) {
            console.error('Error in chat:', error);
        }finally {
            setLoading(false);
        }
    };
    const summarize = async () => {
        if (!model) return;
        setLoading(true);
        try {
            const prompt = `As an experienced recruiter and content curator, answer the following question based on this resume data:\n\n${resumeData}\n\n Question: summarize the whole resume with necessary key details under 250 words with all sections in an ATS parsable rich text content`;
            const result = await model.generateContent([prompt]);
            toast('Summarized!')
            setAnswer(result.response.text());
        } catch (error) {
            console.error('Error in chat:', error);
        }
        finally {
            setLoading(false);
        }
    };

    const copyResult = () =>{
        window.navigator.clipboard.writeText(answer);
        toast('Result Copied!')
    }

    const extractJsonFormat = async () => {
        if (!model || !resumeData) return;

        setLoading(true);
        try {
            const prompt = `Group and categorize each and every aspect of the resume details into a suitable JSON structure based on the following resume:\n\n${resumeData} and each experience should also contain skillset but not categories, also keep a special note that while categorizing the skillset entry individually(outside experience) .. try to group them under respective fields like programming languages,databases,frontend,backend,databases etc.. provide high quality json structure as response`;
            const result = await model.generateContent([prompt]);
            console.log(result.response.text());
            setJsonPreview(result.response.text());
            window.navigator.clipboard.writeText(result.response.text());
            toast('JSON Copied!')
        } catch (error) {
            console.error('Error extracting JSON format:', error);
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
        <div className="max-w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-4 border border-gray-300 rounded-lg">
                <h1 className="text-2xl font-bold mb-4">ResumeGenie ✨📝</h1>
                <span className='text-gray-400'>{`(🗣️ Upload resume and start experimenting! 😎)`}</span>
                <input
                    type="file"
                    accept=".docx,.txt"
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
                <h2 className="text-2xl font-bold mb-4">Shoot Your Questions 🙋🏻‍♂️❓</h2>
                <span className='text-gray-400'>{`(ℹ️ Ask questions to AI about uploaded resume ⬇️)`}</span>
                <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    className="mb-4 border border-gray-300 p-2 rounded w-full"
                />
                <button
                    onClick={handleChat}
                    className={`bg-green-500 text-white p-2 rounded mb-4 ${loading || file==null|| !uploadToggle? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={loading || file==null|| !uploadToggle}
                >
                    Query it!
                </button>
                {answer.length?<button
                        onClick={copyResult}
                        className={`bg-blue-500 text-white ml-4 p-2 rounded ${loading || file==null|| !uploadToggle ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={loading || file==null|| !uploadToggle}
                    >
                        {'Copy Query Result'}
                    </button>:""}

                {answer && (
                    <>
                        <h2 className="text-xl mb-2">Generated Result 💬 :</h2>
                        <p className="border border-gray-300 p-2 whitespace-pre-wrap max-h-96 overflow-y-auto rounded">{answer}</p>
                    </>
                )}
            </div>
        </div>
        <div className='text-center fixed inset-x-0 bottom-0 p-4 lg:absolute lg:left-1/2 lg:transform lg:-translate-x-1/2'>
                Made with ❤️ By <a href='https://dhanushholla.vercel.app' className='text-blue-400 hover:underline'>Dhanush Holla ↗</a>
        </div>

        </div>
    );
};

export default Panel;