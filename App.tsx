import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { engineDatabase, aftermarketPartsDatabase, provenConfigurationsDatabase, shopsDatabase, reviewsDatabase } from './data';
import type { Engine, UserConfiguration, Shop, Review, ChatMessage, GroundingSource } from './types';

interface CalculatorInput {
    engineBore: string;
    engineStroke: string;
    headGasketThickness: string;
    combustionChamberVolume: string;
    pistonVolume: string;
    deckClearance: string;
}

interface DeckCalcInput {
    deckHeight: string;
    stroke: string;
    rodLength: string;
    pistonCompressionHeight: string;
}

interface BuildStep {
    component: string;
    recommendation: string;
    reasoning: string;
}


const App: React.FC = () => {
    const [selectedMake, setSelectedMake] = useState<string>('');
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [selectedEngineCode, setSelectedEngineCode] = useState<string>('');
    const [currentEngine, setCurrentEngine] = useState<Engine | null>(null);
    const [comparisonEngines, setComparisonEngines] = useState<Engine[]>([]);
    
    // Main panel state
    const [activePanel, setActivePanel] = useState<'engineDetails' | 'myGarage' | 'showcase' | 'network' | 'compare'>('engineDetails');
    // Engine details internal tab state
    const [activeTab, setActiveTab] = useState<string>('specs');
    
    // Freemium State
    const [isPro, setIsPro] = useState<boolean>(() => {
        return localStorage.getItem('isPro') === 'true';
    });

    // Centralized store for all user builds
    const [garageBuilds, setGarageBuilds] = useState<UserConfiguration[]>([]);
    
    const [newUserConfig, setNewUserConfig] = useState<Partial<UserConfiguration>>({
        title: '',
        description: '',
        photos: [],
        dynoLink: '',
        pistons: '',
        rods: '',
        crankshaft: '',
        compressionRatio: '',
        horsepower: '',
        torque: '',
        isPublic: false,
        likes: 0,
        shopId: '',
        inductionType: 'Naturally Aspirated',
        injectorSize: '',
        fuelPump: '',
        engineManagement: '',
        headGasketMod: 'No',
        intakeManifoldType: 'Stock',
    });

    const [calculatorInput, setCalculatorInput] = useState<CalculatorInput>({
        engineBore: '',
        engineStroke: '',
        headGasketThickness: '',
        combustionChamberVolume: '',
        pistonVolume: '',
        deckClearance: '0',
    });
    const [crResult, setCrResult] = useState<string | null>(null);

    const [deckCalcInput, setDeckCalcInput] = useState<DeckCalcInput>({
        deckHeight: '',
        stroke: '',
        rodLength: '',
        pistonCompressionHeight: '',
    });
    const [deckClearanceResult, setDeckClearanceResult] = useState<string | null>(null);

    // AI State
    const [ai, setAi] = useState<GoogleGenAI | null>(null);
    const [aiAnalysis, setAiAnalysis] = useState<{ text: string; sources?: GroundingSource[] } | null>(null);
    const [isAnalysisLoading, setIsAnalysisLoading] = useState<boolean>(false);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState<string>('');
    const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const [hpGoal, setHpGoal] = useState<string>('');
    const [budget, setBudget] = useState<string>('');
    const [aiBuildPath, setAiBuildPath] = useState<BuildStep[] | null>(null);
    const [isBuildPathLoading, setIsBuildPathLoading] = useState<boolean>(false);
    
    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
    const [editingBuild, setEditingBuild] = useState<UserConfiguration | null>(null);

    // Network State
    const [activeShop, setActiveShop] = useState<Shop | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isShopSignupVisible, setIsShopSignupVisible] = useState<boolean>(false);

    // Theme state
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
        if (savedTheme) return savedTheme;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    const comparisonColorPalette = [
        'text-blue-600 dark:text-blue-400',
        'text-green-600 dark:text-green-400',
        'text-yellow-500 dark:text-yellow-400',
        'text-fuchsia-600 dark:text-fuchsia-400',
        'text-cyan-500 dark:text-cyan-400',
        'text-orange-500 dark:text-orange-400',
        'text-indigo-500 dark:text-indigo-400',
    ];

    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    // Persist Pro state
    useEffect(() => {
        localStorage.setItem('isPro', String(isPro));
    }, [isPro]);

    const toggleProMode = () => {
        setIsPro(prev => !prev);
    };

    useEffect(() => {
        const apiKey = process.env.API_KEY;
        if (apiKey) {
            // Always use `new GoogleGenAI({ apiKey: process.env.API_KEY })`.
            setAi(new GoogleGenAI({ apiKey }));
        } else {
            console.error("API_KEY is not set.");
        }
    }, []);


    const makes = useMemo(() => [...new Set(engineDatabase.map(e => e.make))].sort(), []);
    const models = useMemo(() => {
        if (!selectedMake) return [];
        return [...new Set(engineDatabase.filter(e => e.make === selectedMake).map(e => e.model))];
    }, [selectedMake]);

    const engines = useMemo(() => {
        if (!selectedMake || !selectedModel) return [];
        return engineDatabase.filter(e => e.make === selectedMake && e.model === selectedModel);
    }, [selectedMake, selectedModel]);

    // Effect to update current engine and reset calculator
    useEffect(() => {
        if (selectedEngineCode) {
            const engine = engineDatabase.find(e => e.make === selectedMake && e.model === selectedModel && e.engineCode === selectedEngineCode) || null;
            setCurrentEngine(engine);
            setActivePanel('engineDetails'); // Switch to engine details when a new engine is selected
            setActiveTab('specs');
            setAiAnalysis(null);
            setChatHistory([]);
            setAiBuildPath(null);
            setHpGoal('');
            setBudget('');
            if (engine) {
                setCalculatorInput({
                    engineBore: String(engine.engineBore || ''),
                    engineStroke: String(engine.engineStroke || ''),
                    headGasketThickness: String(engine.headGasketThickness || ''),
                    combustionChamberVolume: String(engine.combustionChamberVolume || ''),
                    pistonVolume: String(engine.pistonVolume || ''),
                    deckClearance: '0',
                });
                setDeckCalcInput({
                    deckHeight: String(engine.blockDeckHeight || ''),
                    stroke: String(engine.engineStroke || ''),
                    rodLength: String(engine.rodLength || ''),
                    pistonCompressionHeight: String(engine.pistonCompressionHeight || ''),
                });
                setDeckClearanceResult(null);
            }
        } else {
            setCurrentEngine(null);
        }
    }, [selectedMake, selectedModel, selectedEngineCode]);
    
    // Effect for loading ALL user configurations from the garage
    useEffect(() => {
        try {
            const storedBuilds = localStorage.getItem('userGarageBuilds');
            setGarageBuilds(storedBuilds ? JSON.parse(storedBuilds) : []);
        } catch (e) {
            console.error("Error loading garage builds from localStorage", e);
            setGarageBuilds([]);
        }
    }, []);
    
     useEffect(() => {
        if (currentEngine && activeTab === 'aiAdvisor' && chatHistory.length === 0) {
        setChatHistory([
            {
            role: 'system',
            text: `Hi! I'm Jessey, your AI Tuning Advisor. Ask me anything about the ${currentEngine.make} ${currentEngine.engineCode}. For example, "What are the first mods I should do for more power?"`
            }
        ]);
        }
    }, [currentEngine, activeTab, chatHistory.length]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory]);

    // Effect for CR calculation
    useEffect(() => {
        const { engineBore, engineStroke, headGasketThickness, combustionChamberVolume, pistonVolume, deckClearance } = calculatorInput;
        const bore = parseFloat(engineBore);
        const stroke = parseFloat(engineStroke);
        const gasketThickness = parseFloat(headGasketThickness);
        const chamberVolume = parseFloat(combustionChamberVolume);
        const pVolume = parseFloat(pistonVolume);
        const deck = parseFloat(deckClearance);

        if ([bore, stroke, gasketThickness, chamberVolume, pVolume, deck].every(v => !isNaN(v))) {
            const boreCm = bore / 10;
            const strokeCm = stroke / 10;
            const gasketThicknessCm = gasketThickness / 10;
            const deckCm = deck / 10;
            
            const V_swept = Math.PI * Math.pow(boreCm / 2, 2) * strokeCm;
            const V_gasket = Math.PI * Math.pow(boreCm / 2, 2) * gasketThicknessCm;
            const V_deck = Math.PI * Math.pow(boreCm / 2, 2) * deckCm;

            const V_clearance = chamberVolume + pVolume + V_gasket + V_deck;
            
            if (V_clearance > 0) {
                const compressionRatio = (V_swept + V_clearance) / V_clearance;
                setCrResult(compressionRatio.toFixed(2));
            } else {
                setCrResult(null);
            }
        } else {
            setCrResult(null);
        }
    }, [calculatorInput]);

    const handleGenerateAnalysis = async () => {
        if (!currentEngine || !ai) return;

        setIsAnalysisLoading(true);
        setAiAnalysis(null);

        try {
            const systemInstruction = `You are 'Jessey', an expert automotive engineer and engine tuner. Your goal is to provide helpful, accurate, and safe tuning advice. You must use the provided engine data as the primary source of truth for all specifications. If details are missing or null in the provided engine data, you may use Google Search to find relevant general information, but clearly state when you are using external sources. Focus on the engine's strengths, common weaknesses, and tuning potential based on its materials, bore/stroke ratio, and induction type. Format the response in clear, concise paragraphs using markdown for headings and bold text.`;
            
            const prompt = `Based on the following technical specifications, provide a detailed analysis of this engine's strengths, common weaknesses, and tuning potential. Explain how factors like its materials, bore/stroke ratio, and induction type influence its performance characteristics. Format the response in clear, concise paragraphs using markdown for headings and bold text.

            Engine Data:
            ${JSON.stringify(currentEngine, null, 2)}`;

            const response = await ai.models.generateContent({
                // Using 'gemini-3-pro-preview' for complex text tasks as per guidelines.
                model: 'gemini-3-pro-preview',
                contents: prompt,
                config: {
                    systemInstruction,
                    tools: [{ googleSearch: {} }],
                },
            });
            
            const sources: GroundingSource[] = [];
            if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
                for (const chunk of response.candidates[0].groundingMetadata.groundingChunks) {
                    if (chunk.web?.uri && chunk.web?.title) {
                        sources.push({ uri: chunk.web.uri, title: chunk.web.title });
                    }
                }
            }

            setAiAnalysis({ text: response.text, sources });

        } catch (error) {
            console.error("AI Analysis Error:", error);
            setAiAnalysis({ text: "Sorry, I couldn't generate an analysis at this time. Please try again later." });
        } finally {
            setIsAnalysisLoading(false);
        }
    };

    const handleGenerateBuildPath = async () => {
        if (!currentEngine || !ai || !hpGoal || !budget) {
            alert("Please enter both a horsepower goal and a budget.");
            return;
        }

        setIsBuildPathLoading(true);
        setAiBuildPath(null);

        try {
            const systemInstruction = "You are 'Jessey', an expert automotive engineer and engine tuner. Your goal is to provide helpful, accurate, and safe tuning advice. You must use the provided engine data as the primary source of truth for all specifications. Keep your answers concise and focused on the user's question. Use markdown for formatting like lists or bold text when it improves clarity.";
            
            const prompt = `
            Given the following engine specifications, generate a prioritized, step-by-step build path to help a user achieve their performance goals.
            
            **Engine Data:**
            ${JSON.stringify(currentEngine, null, 2)}
            
            **User Goals:**
            - Horsepower Target: ${hpGoal} HP
            - Approximate Budget: $${budget}
            
            Please provide a list of recommended components, starting with the most critical for reliability and power at this level. For each component, provide a brief reasoning.
            `;
            
            const responseSchema = {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        component: { type: Type.STRING, description: "The category of the part (e.g., 'Forged Pistons', 'Turbocharger')." },
                        recommendation: { type: Type.STRING, description: "A specific recommendation or type of part (e.g., 'CP Pistons 9.0:1 CR', 'Garrett G30-770')." },
                        reasoning: { type: Type.STRING, description: "A brief explanation of why this component is necessary or recommended for the build." },
                    },
                    required: ["component", "recommendation", "reasoning"],
                },
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                    // Note: Google Search grounding cannot be used with responseSchema.
                },
            });
            
            const buildPath = JSON.parse(response.text);
            setAiBuildPath(buildPath);

        } catch (error) {
            console.error("AI Build Path Error:", error);
        } finally {
            setIsBuildPathLoading(false);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || !currentEngine || !ai || isChatLoading) return;

        const userMessage: ChatMessage = { role: 'user', text: chatInput };
        setChatHistory(prev => [...prev, userMessage]);
        setChatInput('');
        setIsChatLoading(true);

        try {
            const systemInstruction = `You are 'Jessey', an expert automotive engineer and engine tuner. Your goal is to provide helpful, accurate, and safe tuning advice. You MUST use the provided engine data as the primary source of truth for all specifications. If specific details are not present or are null in the provided engine data, you may use Google Search to find relevant general information, but clearly state when you are using external sources. Keep your answers concise and focused on the user's question. Use markdown for formatting like lists or bold text when it improves clarity.`;
            
            const chatContents = `
            Regarding the ${currentEngine.make} ${currentEngine.model} (${currentEngine.engineCode}) engine:

            Engine Specifications:
            ${JSON.stringify(currentEngine, null, 2)}

            User's question: "${chatInput}"

            Please provide your expert advice, directly referencing the provided engine specifications where applicable.
            `;

            const response = await ai.models.generateContent({
                // Using 'gemini-3-pro-preview' for complex text tasks as per guidelines.
                model: 'gemini-3-pro-preview',
                config: {
                    systemInstruction,
                    tools: [{ googleSearch: {} }],
                },
                contents: chatContents,
            });

            const aiMessage: ChatMessage = { role: 'model', text: response.text };

            // Extract grounding sources
            const sources: GroundingSource[] = [];
            if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
                for (const chunk of response.candidates[0].groundingMetadata.groundingChunks) {
                    if (chunk.web?.uri && chunk.web?.title) {
                        sources.push({ uri: chunk.web.uri, title: chunk.web.title });
                    }
                }
            }
            if (sources.length > 0) {
                aiMessage.groundingSources = sources;
            }

            setChatHistory(prev => [...prev, aiMessage]);

        } catch (error) {
            console.error("AI Chat Error:", error);
            const errorMessage: ChatMessage = { role: 'error', text: "Sorry, I'm having trouble connecting. Please try again." };
            setChatHistory(prev => [...prev, errorMessage]);
        } finally {
            setIsChatLoading(false);
        }
    };

    const handleCalculatorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setCalculatorInput(prev => ({ ...prev, [id]: value }));
    };

    const handleDeckCalcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setDeckCalcInput(prev => ({ ...prev, [id]: value }));
    };

    const calculateDeckClearance = () => {
        const deckHeight = parseFloat(deckCalcInput.deckHeight);
        const stroke = parseFloat(deckCalcInput.stroke);
        const rodLength = parseFloat(deckCalcInput.rodLength);
        const pistonCompHeight = parseFloat(deckCalcInput.pistonCompressionHeight);

        if ([deckHeight, stroke, rodLength, pistonCompHeight].every(v => !isNaN(v))) {
            const clearance = deckHeight - ((stroke / 2) + rodLength + pistonCompHeight);
            setDeckClearanceResult(clearance.toFixed(3));
        } else {
            setDeckClearanceResult(null);
        }
    };

    const applyDeckClearance = () => {
        if (deckClearanceResult !== null) {
            setCalculatorInput(prev => ({
                ...prev,
                deckClearance: deckClearanceResult,
            }));
        }
    };
    
    const handleCalculatorFieldFromEngine = (e: React.ChangeEvent<HTMLSelectElement>, field: keyof CalculatorInput) => {
        const selectedEngineIdentifier = e.target.value;
        if (!selectedEngineIdentifier) return;
    
        const [make, model, engineCode] = selectedEngineIdentifier.split('|');
        const selectedEngine = engineDatabase.find(eng => eng.make === make && eng.model === model && eng.engineCode === engineCode);
        
        if (selectedEngine) {
            const value = selectedEngine[field as keyof Engine]; 
            if (value !== null && value !== undefined) {
                setCalculatorInput(prev => ({
                    ...prev,
                    [field]: String(value)
                }));
            }
        }
        e.target.value = '';
    };

    const handleResetCalculator = () => {
        if (currentEngine) {
            setCalculatorInput({
                engineBore: String(currentEngine.engineBore || ''),
                engineStroke: String(currentEngine.engineStroke || ''),
                headGasketThickness: String(currentEngine.headGasketThickness || ''),
                combustionChamberVolume: String(currentEngine.combustionChamberVolume || ''),
                pistonVolume: String(currentEngine.pistonVolume || ''),
                deckClearance: '0',
            });
             setDeckCalcInput({
                deckHeight: String(currentEngine.blockDeckHeight || ''),
                stroke: String(currentEngine.engineStroke || ''),
                rodLength: String(currentEngine.rodLength || ''),
                pistonCompressionHeight: String(currentEngine.pistonCompressionHeight || ''),
            });
            setDeckClearanceResult(null);
        }
    };

    const handleMakeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedMake(e.target.value);
        setSelectedModel('');
        setSelectedEngineCode('');
        setCurrentEngine(null);
    };

    const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedModel(e.target.value);
        setSelectedEngineCode('');
        setCurrentEngine(null);
    };

    const handleEngineChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedEngineCode(e.target.value);
    };
    
    const addToComparison = () => {
        if (!currentEngine) return;

        // Freemium Check: Comparison Limit
        if (!isPro && comparisonEngines.length >= 2) {
            alert("Free Tier Limited: You can compare up to 2 engines. Upgrade to Pro for unlimited comparisons.");
            return;
        }

        if (!comparisonEngines.some(e => e.engineCode === currentEngine.engineCode && e.model === currentEngine.model)) {
            setComparisonEngines([...comparisonEngines, currentEngine]);
        }
    };
    
    const removeFromComparison = (index: number) => {
        setComparisonEngines(comparisonEngines.filter((_, i) => i !== index));
    };

    const clearComparison = () => {
        setComparisonEngines([]);
    };
    
    const handleUserConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { id, value } = e.target;
        setNewUserConfig(prev => ({...prev, [id]: value}));
    };
    
    const saveUserConfiguration = () => {
        if (!currentEngine) {
            alert('Please select an engine before saving a configuration.');
            return;
        }

        // Freemium Check: Garage Limit
        if (!isPro && garageBuilds.length >= 3) {
            alert("Free Tier Limit Reached! You can save up to 3 builds. Upgrade to Pro to save unlimited builds.");
            return;
        }
        
        const selectedShop = shopsDatabase.find(shop => shop.id === newUserConfig.shopId);

        const newBuild: UserConfiguration = {
            id: Date.now().toString(),
            engineCode: currentEngine.engineCode,
            engineMake: currentEngine.make,
            engineModel: currentEngine.model,
            title: newUserConfig.title || 'My Custom Build',
            description: newUserConfig.description || '',
            photos: typeof newUserConfig.photos === 'string' ? (newUserConfig.photos as string).split(',').map(p => p.trim()).filter(p => p) : [],
            dynoLink: newUserConfig.dynoLink || '',
            isPublic: newUserConfig.isPublic || false,
            likes: 0,
            pistons: newUserConfig.pistons || 'N/A',
            rods: newUserConfig.rods || 'N/A',
            crankshaft: newUserConfig.crankshaft || 'N/A',
            compressionRatio: newUserConfig.compressionRatio || 'N/A',
            horsepower: newUserConfig.horsepower || 'N/A',
            torque: newUserConfig.torque || 'N/A',
            shopId: newUserConfig.shopId,
            shopName: selectedShop?.name,
            inductionType: newUserConfig.inductionType || 'Naturally Aspirated',
            injectorSize: newUserConfig.injectorSize || 'Stock',
            fuelPump: newUserConfig.fuelPump || 'Stock',
            engineManagement: newUserConfig.engineManagement || 'Stock ECU',
            headGasketMod: newUserConfig.headGasketMod || 'No',
            intakeManifoldType: newUserConfig.intakeManifoldType || 'Stock',
        };

        const updatedBuilds = [...garageBuilds, newBuild];
        try {
            localStorage.setItem(`userGarageBuilds`, JSON.stringify(updatedBuilds));
            setGarageBuilds(updatedBuilds);
            setNewUserConfig({ 
                title: '', description: '', photos: [], dynoLink: '', 
                pistons: '', rods: '', crankshaft: '', compressionRatio: '', horsepower: '', torque: '', 
                isPublic: false, likes: 0, shopId: '',
                inductionType: 'Naturally Aspirated', injectorSize: '', fuelPump: '', 
                engineManagement: '', headGasketMod: 'No', intakeManifoldType: 'Stock'
            });
            alert('Your build has been saved to your Garage!');
        } catch(e) {
            console.error("Error saving build to localStorage", e);
            alert('Failed to save configuration.');
        }
    };

    const deleteUserConfiguration = (id: string) => {
        if (window.confirm("Are you sure you want to delete this build? This cannot be undone.")) {
            const updatedBuilds = garageBuilds.filter(build => build.id !== id);
             try {
                localStorage.setItem(`userGarageBuilds`, JSON.stringify(updatedBuilds));
                setGarageBuilds(updatedBuilds);
            } catch(e) {
                console.error("Error deleting user configuration from localStorage", e);
            }
        }
    };
    
    const toggleBuildPublic = (id: string) => {
        const updatedBuilds = garageBuilds.map(build => {
            if (build.id === id) {
                return { ...build, isPublic: !build.isPublic };
            }
            return build;
        });
        try {
            localStorage.setItem(`userGarageBuilds`, JSON.stringify(updatedBuilds));
            setGarageBuilds(updatedBuilds);
        } catch(e) {
            console.error("Error updating build publicity", e);
        }
    };

    const handleLike = (id: string) => {
        const updatedBuilds = garageBuilds.map(build => {
            if (build.id === id) {
                return { ...build, likes: (build.likes || 0) + 1 };
            }
            return build;
        });
        try {
            localStorage.setItem(`userGarageBuilds`, JSON.stringify(updatedBuilds));
            setGarageBuilds(updatedBuilds);
        } catch(e) {
            console.error("Error liking build", e);
        }
    };

    const calculateCubicInches = (liters: number | null | undefined) => {
        if (!liters) return null;
        return (liters * 61.0237).toFixed(2);
    };

    const openEditModal = (build: UserConfiguration) => {
        const buildForEditing = {
            ...build,
            photos: build.photos.join(', '), // Convert photos array to comma-separated string for the input
        };
        setEditingBuild(buildForEditing as any);
        setIsEditModalOpen(true);
    };

    const closeEditModal = () => {
        setIsEditModalOpen(false);
        setEditingBuild(null);
    };

    const handleEditBuildChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        if (!editingBuild) return;
        const { id, value } = e.target;
        setEditingBuild(prev => (prev ? { ...prev, [id]: value } : null));
    };

    const saveEditedBuild = () => {
        if (!editingBuild) return;

        const selectedShop = shopsDatabase.find(shop => shop.id === editingBuild.shopId);

        // Convert photos string back to array before saving
        const buildToSave: UserConfiguration = {
            ...editingBuild,
            photos: typeof editingBuild.photos === 'string'
                ? (editingBuild.photos as string).split(',').map(p => p.trim()).filter(p => p)
                : editingBuild.photos,
            shopName: selectedShop?.name,
        };

        const updatedBuilds = garageBuilds.map(b => (b.id === buildToSave.id ? buildToSave : b));

        try {
            localStorage.setItem(`userGarageBuilds`, JSON.stringify(updatedBuilds));
            setGarageBuilds(updatedBuilds);
            closeEditModal();
        } catch (e) {
            console.error("Error saving edited build to localStorage", e);
            alert('Failed to save changes.');
        }
    };

    const handleShopApplicationSubmit = () => {
        const btn = document.getElementById('submit-app-btn');
        if(btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
            (btn as HTMLButtonElement).disabled = true;
        }
        
        setTimeout(() => {
            alert("Application Submitted Successfully! We will review your details and contact you shortly.");
            setIsShopSignupVisible(false);
        }, 1500);
    };
    
    const comparisonSpecFields: { key: keyof Engine; label: string; unit?: string }[] = [
        { key: 'displacement', label: 'Displacement', unit: 'L' },
        { key: 'horsepower', label: 'Horsepower', unit: 'hp' },
        { key: 'torque', label: 'Torque', unit: 'lb-ft' },
        { key: 'compressionRatio', label: 'Compression Ratio', unit: ':1' },
        { key: 'numCylinders', label: 'Cylinders' },
        { key: 'valvetrain', label: 'Valvetrain' },
        { key: 'inductionType', label: 'Induction' },
        { key: 'fuelSystem', label: 'Fuel System' },
        { key: 'redlineRPM', label: 'Redline', unit: 'RPM' },
        { key: 'engineWeight', label: 'Weight', unit: 'kg' },
        { key: 'blockMaterial', label: 'Block Material' },
        { key: 'headMaterial', label: 'Head Material' },
        { key: 'engineBore', label: 'Bore', unit: 'mm' },
        { key: 'engineStroke', label: 'Stroke', unit: 'mm' },
        { key: 'rodLength', label: 'Rod Length', unit: 'mm' },
        { key: 'pistonCompressionHeight', label: 'Piston Comp. Height', unit: 'mm' },
        { key: 'pistonVolume', label: 'Piston Volume', unit: 'cc' },
        { key: 'combustionChamberVolume', label: 'Combustion Chamber Vol.', unit: 'cc' },
        { key: 'blockDeckHeight', label: 'Block Deck Height', unit: 'mm' },
        { key: 'headGasketThickness', label: 'Head Gasket Thickness', unit: 'mm' },
        { key: 'rodBigEndBore', label: 'Rod Big End Bore', unit: 'mm' },
        { key: 'rodSmallEndBore', label: 'Rod Small End Bore', unit: 'mm' },
        { key: 'connectingRodMaterial', label: 'Connecting Rod Material' },
        { key: 'pistonMaterial', label: 'Piston Material' },
        { key: 'crankshaftMaterial', label: 'Crankshaft Material' },
        { key: 'crankshaftDiameter', label: 'Crankshaft Diameter', unit: 'mm' },
    ];

    const renderSpecs = () => {
        if (!currentEngine) {
            return (
                <div className="text-center p-16 text-gray-500 dark:text-gray-500">
                    <i className="fas fa-search text-5xl mb-4 text-gray-700 dark:text-gray-700"></i>
                    <h2 className="text-xl font-semibold">Select a vehicle to view engine specifications</h2>
                    <p>Choose a make, model, and engine from the dropdowns</p>
                </div>
            );
        }
        
        const specFields = {
            'Displacement': {value: currentEngine.displacement, unit: 'L'},
            'Displacement (CI)': {value: calculateCubicInches(currentEngine.displacement), unit: 'CI'},
            'Horsepower': {value: currentEngine.horsepower, unit: 'hp'},
            'Torque': {value: currentEngine.torque, unit: 'lb-ft'},
            'Compression Ratio': {value: currentEngine.compressionRatio, unit: ':1'},
            'Num. Cylinders': {value: currentEngine.numCylinders, unit: ''},
            'Valvetrain': {value: currentEngine.valvetrain, unit: ''},
            'Induction Type': {value: currentEngine.inductionType, unit: ''},
            'Fuel System': {value: currentEngine.fuelSystem, unit: ''},
            'Redline RPM': {value: currentEngine.redlineRPM, unit: 'RPM'},
            'Engine Weight': {value: currentEngine.engineWeight, unit: 'kg'},
            'Block Material': {value: currentEngine.blockMaterial, unit: ''},
            'Head Material': {value: currentEngine.headMaterial, unit: ''},
            'Engine Bore': {value: currentEngine.engineBore, unit: 'mm'},
            'Engine Stroke': {value: currentEngine.engineStroke, unit: 'mm'},
            'Rod Length': {value: currentEngine.rodLength, unit: 'mm'},
            'Piston Comp. Height': {value: currentEngine.pistonCompressionHeight, unit: 'mm'},
            'Piston Volume': {value: currentEngine.pistonVolume, unit: 'cc'},
            'Combustion Chamber Vol.': {value: currentEngine.combustionChamberVolume, unit: 'cc'},
            'Block Deck Height': {value: currentEngine.blockDeckHeight, unit: 'mm'},
            'Head Gasket Thickness': {value: currentEngine.headGasketThickness, unit: 'mm'},
            'Rod Big End Bore': {value: currentEngine.rodBigEndBore, unit: 'mm'},
            'Rod Small End Bore': {value: currentEngine.rodSmallEndBore, unit: 'mm'},
            'Connecting Rod Material': {value: currentEngine.connectingRodMaterial, unit: ''},
            'Piston Material': {value: currentEngine.pistonMaterial, unit: ''},
            'Crankshaft Material': {value: currentEngine.crankshaftMaterial, unit: ''}
        };

        return (
            <div className="animate-fadeIn">
                {/* Header Section matching the image */}
                <div className="flex flex-col md:flex-row justify-between items-start mb-6 pb-6 border-b border-gray-800">
                    <div>
                        <h1 className="text-4xl font-black text-white mb-1">{currentEngine.engineCode}</h1>
                        <p className="text-lg text-gray-400">{currentEngine.make} {currentEngine.model}</p>
                    </div>
                    <div className="flex gap-4 mt-4 md:mt-0">
                        <div className="bg-[#151515] border border-gray-800 rounded-lg p-4 text-center min-w-[120px] shadow-lg">
                            <div className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1">POWER</div>
                            <div className="text-2xl font-black text-white">{currentEngine.horsepower} <span className="text-sm font-normal text-gray-500">HP</span></div>
                        </div>
                        <div className="bg-[#151515] border border-gray-800 rounded-lg p-4 text-center min-w-[120px] shadow-lg">
                            <div className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1">TORQUE</div>
                            <div className="text-2xl font-black text-white">{currentEngine.torque} <span className="text-sm font-normal text-gray-500">lb-ft</span></div>
                        </div>
                    </div>
                </div>

                {/* Specs Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 mb-8">
                    {Object.entries(specFields).map(([key, spec]) => {
                        if (spec.value === null || spec.value === undefined) return null;

                        return (
                            <div key={key} className="flex justify-between items-baseline border-b border-gray-800 pb-2">
                                <span className="text-gray-400 font-medium">{key}:</span>
                                <span className="text-right">
                                    <span className="font-bold text-lg text-white">{spec.value}</span>
                                    {spec.unit && <span className="text-sm text-blue-400 ml-1">{spec.unit}</span>}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Weaknesses & Strengths Box */}
                {currentEngine.commonWeaknessesStrengths && (
                    <div className="bg-[#1a1a1a] border border-yellow-600/50 rounded-lg p-6 mb-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 bg-yellow-600 h-full"></div>
                        <h3 className="text-yellow-500 font-bold text-lg mb-2 uppercase tracking-wide">Weaknesses & Strengths:</h3>
                        <p className="text-yellow-100/90 leading-relaxed">{currentEngine.commonWeaknessesStrengths}</p>
                    </div>
                )}

                {/* AI Button Section */}
                <div className="mt-8 pt-6 border-t border-gray-800">
                    <button onClick={handleGenerateAnalysis} disabled={isAnalysisLoading || !ai} className="w-full py-3 bg-fuchsia-600 hover:bg-fuchsia-500 rounded-lg font-semibold disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed transition shadow-lg flex items-center justify-center gap-2 text-white">
                        <i className="fas fa-magic-sparkles"></i>
                        {isAnalysisLoading ? 'Analyzing...' : 'Analyze with AI'}
                    </button>
                    {isAnalysisLoading && (
                        <div className="mt-4 p-4 bg-gray-100 dark:bg-[#1a1a1a] rounded-lg text-center text-gray-600 dark:text-gray-400">
                            <i className="fas fa-spinner fa-spin text-2xl"></i>
                            <p className="mt-2">Generating expert analysis...</p>
                        </div>
                    )}
                    {aiAnalysis && (
                        <div className="mt-4 p-4 bg-gray-100 dark:bg-[#1a1a1a] rounded-lg border border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-bold text-fuchsia-600 dark:text-fuchsia-400 mb-2">AI Engine Analysis</h3>
                            <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: aiAnalysis.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />') }} />
                            {aiAnalysis.sources && aiAnalysis.sources.length > 0 && (
                                <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-3">
                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Sources:</p>
                                    <ul className="list-disc list-inside text-sm text-blue-600 dark:text-blue-400 space-y-1">
                                        {aiAnalysis.sources.map((source, sIdx) => (
                                            <li key={sIdx}>
                                                <a href={source.uri} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                                    {source.title || source.uri}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                     {!ai && (
                        <div className="mt-4 text-center text-xs text-yellow-500">
                            <p>AI features are disabled. API Key not found.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };
    
    const calculatorFields: { id: keyof CalculatorInput; label: string; unit: string; tooltip?: string }[] = [
        { id: 'engineBore', label: 'Bore', unit: 'mm' },
        { id: 'engineStroke', label: 'Stroke', unit: 'mm' },
        { id: 'headGasketThickness', label: 'Gasket Thickness', unit: 'mm' },
        { id: 'combustionChamberVolume', label: 'Combustion Chamber', unit: 'cc' },
        { id: 'pistonVolume', label: 'Piston Volume', unit: 'cc', tooltip: 'Use a negative number for domed pistons and a positive number for dished pistons.' },
        { id: 'deckClearance', label: 'Deck Clearance', unit: 'mm' },
    ];
    
    const deckCalculatorFields: { id: keyof DeckCalcInput; label: string; unit: string }[] = [
        { id: 'deckHeight', label: 'Deck Height', unit: 'mm' },
        { id: 'stroke', label: 'Stroke', unit: 'mm' },
        { id: 'rodLength', label: 'Rod Length', unit: 'mm' },
        { id: 'pistonCompressionHeight', label: 'Piston Comp. Height', unit: 'mm' },
    ];

    const renderCRCalculator = () => {
         if (!currentEngine) {
            return (
                <div className="text-center p-16 text-gray-500 dark:text-gray-500">
                    <i className="fas fa-calculator text-5xl mb-4 text-gray-700 dark:text-gray-700"></i>
                    <h2 className="text-xl font-semibold">Select an Engine</h2>
                    <p>Select an engine to use the CR Calculator.</p>
                </div>
            );
        }

        return (
            <div>
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">Engine Calculators</h2>
                </div>

                {/* Deck Clearance Calculator */}
                <div className="bg-gray-50 dark:bg-[#1a1a1a] p-6 rounded-lg mb-6 border border-gray-200 dark:border-gray-700">
                    <div className="flex justify-center items-center gap-2 mb-2">
                        <h3 className="text-lg font-bold text-yellow-600 dark:text-yellow-400">Deck Clearance Calculator</h3>
                        <div className="relative flex items-center group">
                            <i className="fas fa-info-circle text-gray-500 cursor-help"></i>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs p-3 text-xs text-white bg-gray-900 border border-gray-700 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                Deck clearance is the distance between the piston deck at TDC and the deck surface of the engine block.
                                <br /><br />
                                <strong>Negative Clearance:</strong> The piston protrudes slightly from the deck surface.
                                <br />
                                <strong>Positive Clearance:</strong> The piston sits a bit inside the cylinder bore.
                            </div>
                        </div>
                    </div>
                     <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
                        Formula: Deck Height - ((Stroke / 2) + Rod Length + Piston Comp. Height)
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {deckCalculatorFields.map(field => (
                             <div key={field.id}>
                                <label htmlFor={field.id} className="block text-sm font-medium text-gray-600 dark:text-gray-400">{`${field.label} (${field.unit})`}</label>
                                <input
                                    type="number"
                                    id={field.id}
                                    value={deckCalcInput[field.id]}
                                    onChange={handleDeckCalcChange}
                                    className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                />
                            </div>
                        ))}
                    </div>
                    <button onClick={calculateDeckClearance} className="mt-4 w-full py-2 bg-yellow-500 hover:bg-yellow-400 text-black rounded-lg font-semibold transition">Calculate Deck Clearance</button>
                    {deckClearanceResult !== null && (
                        <div className="text-center mt-4 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                            <div className="flex justify-center items-center gap-2 mb-1">
                                <p className="text-gray-600 dark:text-gray-400">Result</p>
                                <div className="relative flex items-center group">
                                    <i className="fas fa-info-circle text-gray-500 cursor-help"></i>
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs p-3 text-xs text-white bg-gray-900 border border-gray-700 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                        Deck clearance is the distance between the piston deck at TDC and the deck surface of the engine block.
                                        <br /><br />
                                        <strong>Negative Clearance:</strong> The piston protrudes slightly from the deck surface.
                                        <br />
                                        <strong>Positive Clearance:</strong> The piston sits a bit inside the cylinder bore.
                                    </div>
                                </div>
                            </div>
                            <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{deckClearanceResult} mm</p>
                            <button onClick={applyDeckClearance} className="mt-2 w-full py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold transition">Apply to CR Calculator</button>
                        </div>
                    )}
                </div>

                {/* CR Calculator */}
                <div className="bg-gray-50 dark:bg-[#1a1a1a] p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-cyan-600 dark:text-cyan-400 text-center mb-4">Compression Ratio Calculator</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {calculatorFields.map(field => (
                            <div key={field.id} className="mb-2">
                                <div className="flex items-center gap-1 mb-1">
                                     <label htmlFor={field.id} className="block text-sm font-medium text-gray-600 dark:text-gray-400">{`${field.label} (${field.unit})`}</label>
                                     {field.tooltip && (
                                        <div className="relative flex items-center group">
                                            <i className="fas fa-info-circle text-gray-400 text-xs cursor-help"></i>
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 text-xs text-white bg-gray-900 border border-gray-700 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                {field.tooltip}
                                            </div>
                                        </div>
                                     )}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        id={field.id}
                                        value={calculatorInput[field.id]}
                                        onChange={handleCalculatorChange}
                                        className="flex-1 p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                    />
                                    {field.id !== 'deckClearance' && (
                                        <select
                                            onChange={(e) => handleCalculatorFieldFromEngine(e, field.id)}
                                            className="w-1/3 p-2 text-xs border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 truncate"
                                            value=""
                                        >
                                            <option value="">Load Spec...</option>
                                            {engineDatabase.map((eng, idx) => (
                                                <option key={idx} value={`${eng.make}|${eng.model}|${eng.engineCode}`}>
                                                    {eng.engineCode}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-4 mt-6">
                        <button onClick={handleResetCalculator} className="w-1/3 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-semibold transition">Reset to Stock</button>
                        <div className="w-2/3 flex justify-center items-center bg-gray-200 dark:bg-gray-800 rounded-lg">
                            <span className="text-gray-600 dark:text-gray-400 mr-2">Result:</span>
                            <span className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{crResult ? `${crResult} : 1` : '--'}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderUpgrades = () => {
        if (!currentEngine) return null;
        const parts = aftermarketPartsDatabase[currentEngine.engineCode];
        const configs = provenConfigurationsDatabase[currentEngine.engineCode];
        
        if (!parts && !configs) {
            return (
                 <div className="text-center p-16 text-gray-500 dark:text-gray-500">
                    <i className="fas fa-cogs text-5xl mb-4 text-gray-700 dark:text-gray-700"></i>
                    <h2 className="text-xl font-semibold">No Aftermarket Data Found</h2>
                    <p>We don't have detailed upgrade data for the {currentEngine.engineCode} yet.</p>
                </div>
            );
        }

        return (
            <div className="space-y-8">
                {parts && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {Object.entries(parts).map(([category, items]) => (
                            <div key={category} className="bg-white dark:bg-[#1a1a1a] p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
                                <h3 className="text-lg font-bold text-purple-600 dark:text-purple-400 mb-3 border-b border-gray-100 dark:border-gray-700 pb-2">{category}</h3>
                                <ul className="space-y-3">
                                    {items.map((item, idx) => (
                                        <li key={idx} className={`flex flex-col ${(!isPro && idx > 0) ? 'blur-sm select-none opacity-50' : ''}`}>
                                            <div className="flex justify-between items-start">
                                                <span className="font-semibold text-gray-800 dark:text-gray-200">{item.name}</span>
                                                {item.link && <a href={item.link} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">View</a>}
                                            </div>
                                            <span className="text-sm text-gray-500 dark:text-gray-400">{item.description}</span>
                                        </li>
                                    ))}
                                </ul>
                                
                                {!isPro && items.length > 1 && (
                                    <div className="absolute inset-0 top-12 flex flex-col items-center justify-center bg-white/10 dark:bg-black/20 backdrop-blur-[1px]">
                                        <div className="bg-white dark:bg-[#1e1e1e] p-3 rounded-lg shadow-xl border border-purple-500/30 text-center transform scale-90">
                                            <i className="fas fa-lock text-2xl text-purple-500 mb-2"></i>
                                            <p className="text-sm font-bold text-gray-900 dark:text-white">Pro Feature</p>
                                            <p className="text-xs text-gray-500 mb-2">Upgrade to see full list</p>
                                            <button onClick={toggleProMode} className="text-xs bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded-full transition">Simulate Upgrade</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Proven Configurations Section */}
                {configs && configs.length > 0 && (
                     <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-900 to-gray-900">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <i className="fas fa-clipboard-check text-green-400"></i> Proven Configurations
                            </h3>
                            <p className="text-blue-200 text-sm">Dyno-verified recipes for this engine.</p>
                        </div>
                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                            {configs.map((config, idx) => (
                                <div key={idx} className="p-6 hover:bg-gray-50 dark:hover:bg-[#252525] transition">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-3">
                                        <h4 className="font-bold text-lg text-blue-600 dark:text-blue-400">{config.name}</h4>
                                        <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-sm font-bold rounded-full">
                                            {config.powerOutput}
                                        </span>
                                    </div>
                                    <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm">{config.description}</p>
                                    
                                    <div>
                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Key Components:</span>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {config.keyComponents.map((comp, i) => (
                                                <span key={i} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded border border-gray-200 dark:border-gray-600">
                                                    {comp}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                     </div>
                )}

                {!isPro && (
                    <div className="col-span-1 md:col-span-2 mt-6 p-6 bg-gradient-to-r from-purple-900 to-indigo-900 rounded-xl text-white text-center relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-2xl font-bold mb-2">Unlock Full Parts Database</h3>
                            <p className="mb-4 text-gray-200">Get access to over 5,000+ verified part combinations, dyno-proven setups, and direct vendor links with TunerSpecs Pro.</p>
                            <button onClick={toggleProMode} className="px-6 py-2 bg-white text-purple-900 font-bold rounded-full hover:bg-gray-100 transition transform hover:scale-105">Upgrade to Pro</button>
                        </div>
                        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-purple-500 rounded-full opacity-20 blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-indigo-500 rounded-full opacity-20 blur-3xl"></div>
                    </div>
                )}
            </div>
        );
    };
    
    const renderBuilds = () => {
        if (!currentEngine) return null;
        const garageCount = garageBuilds.length;
        const limit = 3;

        return (
            <div className="space-y-8">
                 {/* AI Build Path Generator */}
                 <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                     <div className="flex items-center gap-3 mb-4">
                         <div className="bg-fuchsia-100 dark:bg-fuchsia-900 p-2 rounded-lg text-fuchsia-600 dark:text-fuchsia-400">
                             <i className="fas fa-robot text-xl"></i>
                         </div>
                         <div>
                             <h3 className="text-lg font-bold text-gray-900 dark:text-white">AI Build Path Generator</h3>
                             <p className="text-sm text-gray-500 dark:text-gray-400">Get a step-by-step parts list for your power goal.</p>
                         </div>
                     </div>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                         <div>
                             <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Horsepower Goal</label>
                             <input 
                                type="number" 
                                value={hpGoal} 
                                onChange={(e) => setHpGoal(e.target.value)}
                                placeholder="e.g. 400"
                                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                             />
                         </div>
                         <div>
                             <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Budget ($)</label>
                             <input 
                                type="number" 
                                value={budget} 
                                onChange={(e) => setBudget(e.target.value)}
                                placeholder="e.g. 5000"
                                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                             />
                         </div>
                     </div>
                     
                     <button 
                        onClick={handleGenerateBuildPath} 
                        disabled={isBuildPathLoading || !ai}
                        className="w-full py-3 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white font-bold rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                     >
                         {isBuildPathLoading ? <><i className="fas fa-spinner fa-spin"></i> Generating Plan...</> : <><i className="fas fa-bolt"></i> Generate Build Path</>}
                     </button>

                     {aiBuildPath && (
                         <div className="mt-6 space-y-4">
                             <h4 className="font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">Recommended Path</h4>
                             {aiBuildPath.map((step, idx) => (
                                 <div key={idx} className="flex gap-4 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                                     <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 font-bold text-sm">
                                         {idx + 1}
                                     </div>
                                     <div>
                                         <p className="font-semibold text-gray-900 dark:text-white">{step.component}: <span className="text-blue-600 dark:text-blue-400">{step.recommendation}</span></p>
                                         <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{step.reasoning}</p>
                                     </div>
                                 </div>
                             ))}
                         </div>
                     )}
                 </div>

                {/* Upload Your Build Section */}
                 <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-lg font-bold text-green-600 dark:text-green-400">Upload Your Build</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Save your engine configuration and parts list to your Garage.</p>
                        </div>
                        <div className={`px-3 py-1 rounded text-xs font-bold ${isPro ? 'bg-green-100 text-green-600' : (garageCount >= limit ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600')}`}>
                            {isPro ? (
                                <span><i className="fas fa-infinity"></i> Unlimited Builds (Pro)</span>
                            ) : (
                                <span>{garageCount}/{limit} Builds Used (Free)</span>
                            )}
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <input type="text" id="title" placeholder="Build Title (e.g., My Street Beast)" value={newUserConfig.title} onChange={handleUserConfigChange} className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" />
                         <textarea id="description" placeholder="Detailed description of your build..." value={newUserConfig.description} onChange={handleUserConfigChange} className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white h-24"></textarea>
                         <input type="text" id="photos" placeholder="Photo URLs (comma separated)" value={newUserConfig.photos?.toString()} onChange={handleUserConfigChange} className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" />
                         <input type="text" id="dynoLink" placeholder="Dyno Video Link (YouTube)" value={newUserConfig.dynoLink} onChange={handleUserConfigChange} className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" />

                        <div className="grid grid-cols-2 gap-4">
                             <input type="text" id="horsepower" placeholder="Est. HP" value={newUserConfig.horsepower} onChange={handleUserConfigChange} className="p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" />
                             <input type="text" id="torque" placeholder="Est. Torque" value={newUserConfig.torque} onChange={handleUserConfigChange} className="p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <input type="text" id="pistons" placeholder="Pistons" value={newUserConfig.pistons} onChange={handleUserConfigChange} className="p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" />
                            <input type="text" id="rods" placeholder="Rods" value={newUserConfig.rods} onChange={handleUserConfigChange} className="p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" />
                        </div>

                        {/* New Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="inductionType" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Induction Type</label>
                                <select id="inductionType" value={newUserConfig.inductionType} onChange={handleUserConfigChange} className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white">
                                    <option value="Naturally Aspirated">Naturally Aspirated</option>
                                    <option value="Turbocharged">Turbocharged</option>
                                    <option value="Supercharged">Supercharged</option>
                                </select>
                            </div>
                             <div>
                                <label htmlFor="intakeManifoldType" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Intake Manifold</label>
                                <select id="intakeManifoldType" value={newUserConfig.intakeManifoldType} onChange={handleUserConfigChange} className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white">
                                    <option value="Stock">Stock</option>
                                    <option value="Aftermarket">Aftermarket</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="injectorSize" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Injector Size</label>
                                <input type="text" id="injectorSize" placeholder="e.g. 1000cc" value={newUserConfig.injectorSize} onChange={handleUserConfigChange} className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" />
                            </div>
                            <div>
                                <label htmlFor="fuelPump" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Fuel Pump Size</label>
                                <input type="text" id="fuelPump" placeholder="e.g. Walbro 450" value={newUserConfig.fuelPump} onChange={handleUserConfigChange} className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="engineManagement" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Engine Management</label>
                                <input type="text" id="engineManagement" placeholder="e.g. Haltech Elite 1500" value={newUserConfig.engineManagement} onChange={handleUserConfigChange} className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" />
                            </div>
                            <div>
                                <label htmlFor="headGasketMod" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">MLS Gasket/Spacer/O-Ring</label>
                                <select id="headGasketMod" value={newUserConfig.headGasketMod} onChange={handleUserConfigChange} className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white">
                                    <option value="No">No (Stock)</option>
                                    <option value="Yes">Yes (Upgraded)</option>
                                </select>
                            </div>
                        </div>


                        {/* Work Performed By Dropdown */}
                        <div>
                            <label htmlFor="shopId" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Work Performed By (Optional)</label>
                            <select
                                id="shopId"
                                value={newUserConfig.shopId}
                                onChange={handleUserConfigChange}
                                className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                            >
                                <option value="">-- Select a Verified Shop --</option>
                                {shopsDatabase.map(shop => (
                                    <option key={shop.id} value={shop.id}>{shop.name} - {shop.location}</option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Link this build to a shop in our network to verify your results.</p>
                        </div>

                         <div className="flex items-center gap-2 pt-2">
                             <input type="checkbox" id="isPublic" checked={newUserConfig.isPublic} onChange={(e) => setNewUserConfig(prev => ({...prev, isPublic: e.target.checked}))} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
                             <label htmlFor="isPublic" className="text-gray-700 dark:text-gray-300">Make this build public in Showcase?</label>
                         </div>

                        <button onClick={saveUserConfiguration} className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold text-white transition shadow-lg">Save to Garage</button>
                    </div>
                </div>
            </div>
        );
    };

    const renderCompare = () => {
         return (
             <div className="overflow-hidden">
                 <div className="flex justify-between items-center mb-6">
                     <div>
                        <h2 className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">Engine Comparison</h2>
                        <p className="text-gray-500 text-sm">Add engines to compare specs side-by-side</p>
                     </div>
                     <div className="flex gap-2">
                         {currentEngine && (
                            <button onClick={addToComparison} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold shadow transition">
                                <i className="fas fa-plus mr-2"></i> Add Current
                            </button>
                         )}
                         <button onClick={clearComparison} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition">
                             Clear All
                         </button>
                     </div>
                 </div>
                 
                 {comparisonEngines.length === 0 ? (
                     <div className="text-center py-16 bg-gray-50 dark:bg-[#1a1a1a] rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                         <i className="fas fa-exchange-alt text-4xl text-gray-300 dark:text-gray-600 mb-3"></i>
                         <p className="text-gray-500 dark:text-gray-400">No engines selected for comparison.</p>
                         <p className="text-sm text-gray-400">Select an engine above and click "Add Current"</p>
                     </div>
                 ) : (
                     <div className="overflow-x-auto pb-4 comparison-scrollbar">
                         <table className="w-full text-left border-collapse">
                             <thead>
                                 <tr>
                                     <th className="p-4 bg-gray-100 dark:bg-gray-800 min-w-[150px] sticky left-0 z-10 border-b border-r border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold">Spec</th>
                                     {comparisonEngines.map((eng, idx) => (
                                         <th key={idx} className="p-4 min-w-[200px] border-b border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e1e1e]">
                                             <div className="flex justify-between items-start">
                                                 <div>
                                                     <div className={`font-bold text-lg ${comparisonColorPalette[idx % comparisonColorPalette.length]}`}>{eng.engineCode}</div>
                                                     <div className="text-sm text-gray-500">{eng.make} {eng.model}</div>
                                                 </div>
                                                 <button onClick={() => removeFromComparison(idx)} className="text-gray-400 hover:text-red-500 transition">
                                                     <i className="fas fa-times"></i>
                                                 </button>
                                             </div>
                                         </th>
                                     ))}
                                 </tr>
                             </thead>
                             <tbody>
                                 {comparisonSpecFields.map((field, idx) => (
                                     <tr key={idx} className={idx % 2 === 0 ? "bg-gray-50 dark:bg-[#1a1a1a]" : "bg-white dark:bg-[#1e1e1e]"}>
                                         <td className="p-3 font-medium text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 sticky left-0 bg-inherit z-10 text-sm">
                                             {field.label}
                                         </td>
                                         {comparisonEngines.map((eng, eIdx) => (
                                             <td key={eIdx} className="p-3 border-r border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 text-sm">
                                                 {eng[field.key]} {eng[field.key] ? field.unit : ''}
                                             </td>
                                         ))}
                                     </tr>
                                 ))}
                             </tbody>
                         </table>
                     </div>
                 )}
             </div>
         );
    };

    const renderAiAdvisor = () => {
        if (!ai) return (
            <div className="text-center p-10 text-yellow-500">AI features are disabled. API Key not found.</div>
        );
        
        return (
            <div className="flex flex-col h-[600px]">
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-[#1a1a1a] rounded-t-lg border border-gray-200 dark:border-gray-700">
                    {chatHistory.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-3 rounded-lg ${
                                msg.role === 'user' 
                                ? 'bg-blue-600 text-white rounded-br-none' 
                                : msg.role === 'error'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-bl-none'
                            }`}>
                                {msg.role === 'model' || msg.role === 'system' ? (
                                    <>
                                        <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />') }} />
                                        {msg.groundingSources && msg.groundingSources.length > 0 && (
                                            <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-3">
                                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Sources:</p>
                                                <ul className="list-disc list-inside text-xs text-blue-600 dark:text-blue-400 space-y-1">
                                                    {msg.groundingSources.map((source, sIdx) => (
                                                        <li key={sIdx}>
                                                            <a href={source.uri} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                                                {source.title || source.uri}
                                                            </a>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    msg.text
                                )}
                            </div>
                        </div>
                    ))}
                    {isChatLoading && (
                         <div className="flex justify-start">
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg rounded-bl-none border border-gray-200 dark:border-gray-700">
                                <i className="fas fa-ellipsis-h animate-pulse text-gray-400"></i>
                            </div>
                        </div>
                    )}
                </div>
                <form onSubmit={handleSendMessage} className="p-4 bg-white dark:bg-[#1e1e1e] border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-lg flex gap-2">
                    <input 
                        type="text" 
                        value={chatInput} 
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Ask Jessey about tuning, parts, or potential issues..."
                        className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isChatLoading}
                    />
                    <button 
                        type="submit" 
                        disabled={isChatLoading || !chatInput.trim()}
                        className="px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Send
                    </button>
                </form>
            </div>
        );
    };

    const renderShopSignup = () => {
        return (
            <div className="max-w-3xl mx-auto">
                <button onClick={() => setIsShopSignupVisible(false)} className="mb-6 text-blue-500 hover:text-blue-400 flex items-center gap-2">
                    <i className="fas fa-arrow-left"></i> Back to Directory
                </button>
                
                <div className="bg-[#1e1e1e] border border-gray-700 rounded-xl p-8 shadow-2xl">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i className="fas fa-store text-2xl text-blue-400"></i>
                        </div>
                        <h2 className="text-2xl font-bold text-white">Join the TunerSpecs Verified Network</h2>
                        <p className="text-gray-400 mt-2">Connect with serious enthusiasts planning their next build.</p>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Shop Name</label>
                                <input type="text" className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded-lg text-white focus:border-blue-500 outline-none" placeholder="e.g. Apex Performance" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Location</label>
                                <input type="text" className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded-lg text-white focus:border-blue-500 outline-none" placeholder="City, State/Country" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Specialties</label>
                            <input type="text" className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded-lg text-white focus:border-blue-500 outline-none" placeholder="e.g. Dyno Tuning, LS Swaps, BMW M-Power (comma separated)" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Shop Description</label>
                            <textarea className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded-lg text-white focus:border-blue-500 outline-none h-32" placeholder="Tell us about your shop, experience, and services..."></textarea>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Contact Email</label>
                                <input type="email" className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded-lg text-white focus:border-blue-500 outline-none" placeholder="contact@yourshop.com" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Phone Number</label>
                                <input type="tel" className="w-full p-3 bg-[#0f172a] border border-gray-700 rounded-lg text-white focus:border-blue-500 outline-none" placeholder="(555) 123-4567" />
                            </div>
                        </div>

                        <div className="pt-4">
                            <button 
                                id="submit-app-btn"
                                onClick={handleShopApplicationSubmit}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-lg transition shadow-lg"
                            >
                                Submit Application
                            </button>
                            <p className="text-xs text-gray-500 text-center mt-4">By submitting, you agree to our Partner Terms & Conditions.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderShopProfile = () => {
        if (!activeShop) return null;

        const shopReviews = reviewsDatabase.filter(r => r.shopId === activeShop.id);
        const verifiedBuilds = garageBuilds.filter(b => b.shopId === activeShop.id && b.isPublic);

        return (
            <div className="animate-fadeIn">
                <button onClick={() => setActiveShop(null)} className="mb-4 text-blue-500 hover:text-blue-400 flex items-center gap-2">
                    <i className="fas fa-arrow-left"></i> Back to Directory
                </button>
                
                {/* Header */}
                <div className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden mb-6">
                     <div className="h-48 bg-gradient-to-r from-gray-800 to-gray-900 relative">
                         {activeShop.gallery[0] && (
                             <img src={activeShop.gallery[0]} alt="Shop Cover" className="w-full h-full object-cover opacity-50" />
                         )}
                         <div className="absolute bottom-0 left-0 p-6">
                             <h1 className="text-3xl font-bold text-white mb-1">{activeShop.name}</h1>
                             <p className="text-gray-300 flex items-center gap-2"><i className="fas fa-map-marker-alt"></i> {activeShop.location}</p>
                         </div>
                     </div>
                     <div className="p-6">
                         <div className="flex flex-wrap gap-2 mb-4">
                             {activeShop.specialties.map((spec, i) => (
                                 <span key={i} className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">{spec}</span>
                             ))}
                         </div>
                         <p className="text-gray-700 dark:text-gray-300 mb-6">{activeShop.description}</p>
                         
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                             <a href={`tel:${activeShop.contact.phone}`} className="flex items-center justify-center gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-gray-700 dark:text-gray-300">
                                 <i className="fas fa-phone"></i> {activeShop.contact.phone}
                             </a>
                             <a href={`mailto:${activeShop.contact.email}`} className="flex items-center justify-center gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-gray-700 dark:text-gray-300">
                                 <i className="fas fa-envelope"></i> Email
                             </a>
                             <a href={activeShop.contact.website} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-gray-700 dark:text-gray-300">
                                 <i className="fas fa-globe"></i> Website
                             </a>
                         </div>
                     </div>
                </div>

                {/* Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Column */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Verified Builds */}
                         <div className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <i className="fas fa-check-circle text-green-500"></i> Verified Showcase Builds
                            </h2>
                            {verifiedBuilds.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {verifiedBuilds.map(build => (
                                        <div key={build.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                                            <h3 className="font-bold text-gray-800 dark:text-white">{build.title}</h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{build.engineMake} {build.engineModel}</p>
                                            <div className="text-xs text-green-600 dark:text-green-400 font-mono bg-green-100 dark:bg-green-900/30 inline-block px-2 py-1 rounded">
                                                {build.horsepower} HP / {build.torque} TQ
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-500 dark:text-gray-400 italic">No verified builds linked yet.</p>
                            )}
                         </div>

                         {/* Reviews */}
                         <div className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Community Reviews</h2>
                            <div className="space-y-4">
                                {shopReviews.map(review => (
                                    <div key={review.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0 pb-4 last:pb-0">
                                        <div className="flex justify-between mb-1">
                                            <span className="font-bold text-gray-800 dark:text-gray-200">{review.title}</span>
                                            <div className="text-yellow-500">
                                                {[...Array(5)].map((_, i) => (
                                                    <i key={i} className={`fas fa-star ${i < review.rating ? '' : 'text-gray-300 dark:text-gray-600'}`}></i>
                                                ))}
                                            </div>
                                        </div>
                                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">{review.text}</p>
                                        <div className="text-xs text-gray-400">By {review.author} on {review.date}</div>
                                    </div>
                                ))}
                                {shopReviews.length === 0 && <p className="text-gray-500">No reviews yet.</p>}
                            </div>
                         </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        <div className="bg-blue-600 rounded-xl p-6 text-white">
                            <h3 className="font-bold text-lg mb-2">Ready to build?</h3>
                            <p className="text-blue-100 text-sm mb-4">Contact {activeShop.name} directly to schedule your consultation.</p>
                            <button className="w-full py-2 bg-white text-blue-600 font-bold rounded-lg hover:bg-gray-100 transition">Request Quote</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const renderNetwork = () => {
        if (isShopSignupVisible) return renderShopSignup();
        if (activeShop) return renderShopProfile();

        const filteredShops = shopsDatabase.filter(shop => 
            shop.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            shop.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
            shop.specialties.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
        );

        return (
            <div className="space-y-6">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Verified Shops & Tuner Network</h2>
                    <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">Find trusted shops, tuners, and fabricators vetted by the community. Connect with experts who know your engine inside and out.</p>
                </div>

                {/* Search Bar */}
                <div className="relative max-w-2xl mx-auto mb-10">
                    <i className="fas fa-search absolute left-4 top-3.5 text-gray-400"></i>
                    <input 
                        type="text" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 text-gray-900 dark:text-white placeholder-gray-500 shadow-sm" 
                        placeholder="Search shops by name, location, or specialty..." 
                    />
                </div>

                {/* Shop Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredShops.map(shop => (
                        <div key={shop.id} className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:border-blue-400 dark:hover:border-gray-500 transition-all shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-lg text-gray-900 dark:text-white">{shop.name}</h3>
                                <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm">
                                    <i className="fas fa-map-marker-alt mr-1"></i>
                                    {shop.location}
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-4">
                                {shop.specialties.slice(0, 3).map((spec, i) => (
                                    <span key={i} className="bg-gray-100 dark:bg-[#2d3748] text-gray-700 dark:text-gray-300 text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600">{spec}</span>
                                ))}
                                {shop.specialties.length > 3 && <span className="text-gray-500 text-xs py-1">+ {shop.specialties.length - 3} more</span>}
                            </div>
                            <button onClick={() => setActiveShop(shop)} className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 text-sm font-semibold flex items-center">
                                View Profile & Reviews <i className="fas fa-arrow-right ml-1"></i>
                            </button>
                        </div>
                    ))}
                </div>
                
                {filteredShops.length === 0 && (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <p>No shops found matching your search.</p>
                    </div>
                )}

                {/* CTA Banner */}
                <div className="bg-[#0f172a] rounded-xl p-8 text-center mt-12 border border-gray-800 shadow-xl relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="text-xl font-bold text-white mb-2">Are you a shop owner?</h3>
                        <p className="text-gray-400 mb-6">Get your business listed in our Verified Network and connect with thousands of enthusiasts.</p>
                        <button onClick={() => setIsShopSignupVisible(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-semibold transition transform hover:scale-105">
                            Get listed here
                        </button>
                    </div>
                    {/* Decorative background blobs */}
                    <div className="absolute top-0 left-0 w-64 h-64 bg-blue-900/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
                    <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-900/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
                </div>
            </div>
        );
    };

    const renderGarage = () => {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {garageBuilds.map((build) => (
                    <div key={build.id} className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-gray-700 shadow-md overflow-hidden flex flex-col">
                        <div className="h-32 bg-gradient-to-r from-gray-700 to-gray-900 relative">
                            {build.photos && build.photos.length > 0 ? (
                                <img src={build.photos[0]} alt={build.title} className="w-full h-full object-cover opacity-80" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-500">
                                    <i className="fas fa-car text-4xl"></i>
                                </div>
                            )}
                            <div className="absolute top-2 right-2">
                                {build.isPublic ? (
                                    <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow">Public</span>
                                ) : (
                                    <span className="bg-gray-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow">Private</span>
                                )}
                            </div>
                        </div>
                        <div className="p-4 flex-1 flex flex-col">
                            <div className="mb-4">
                                <h3 className="font-bold text-lg text-gray-900 dark:text-white line-clamp-1">{build.title}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{build.engineMake} {build.engineModel} - {build.engineCode}</p>
                                {build.shopName && (
                                    <div className="mt-2 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                                        <i className="fas fa-wrench"></i>
                                        <span>Built by {build.shopName}</span>
                                    </div>
                                )}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 mb-4 text-xs text-gray-600 dark:text-gray-400">
                                <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-center">
                                    <span className="block font-bold text-gray-800 dark:text-gray-200">{build.horsepower || '--'}</span>
                                    HP
                                </div>
                                <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-center">
                                    <span className="block font-bold text-gray-800 dark:text-gray-200">{build.torque || '--'}</span>
                                    TQ
                                </div>
                            </div>
                            
                             <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                                <p><strong>Induction:</strong> {build.inductionType || 'N/A'}</p>
                                <p><strong>Fuel:</strong> {build.injectorSize || 'Stock'}</p>
                            </div>

                            <div className="mt-auto flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-800">
                                <button onClick={() => toggleBuildPublic(build.id)} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                                    {build.isPublic ? 'Make Private' : 'Make Public'}
                                </button>
                                <div className="flex gap-3">
                                    <button onClick={() => openEditModal(build)} className="text-blue-500 hover:text-blue-600">
                                        <i className="fas fa-edit"></i>
                                    </button>
                                    <button onClick={() => deleteUserConfiguration(build.id)} className="text-red-500 hover:text-red-600">
                                        <i className="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                {garageBuilds.length === 0 && (
                    <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#1a1a1a] rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                        <i className="fas fa-warehouse text-4xl mb-3"></i>
                        <p>Your garage is empty.</p>
                        <button onClick={() => {setActivePanel('engineDetails'); setActiveTab('builds');}} className="mt-4 text-blue-600 dark:text-blue-400 font-bold hover:underline">Start a new build</button>
                    </div>
                )}
            </div>
        );
    };

    const renderShowcase = () => {
        const publicBuilds = garageBuilds.filter(b => b.isPublic);
        
        return (
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">Community Showcase</h2>
                    <p className="text-gray-600 dark:text-gray-400">Featured builds from our community of tuners.</p>
                </div>

                {publicBuilds.length === 0 ? (
                     <div className="text-center py-16 bg-gray-50 dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-gray-700">
                        <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-yellow-500 dark:text-yellow-400 text-3xl">
                            <i className="fas fa-trophy"></i>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">The Showcase is Empty</h3>
                        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                            Make one of your builds public from the 'My Garage' tab to feature it here!
                        </p>
                    </div>
                ) : (
                    publicBuilds.map(build => (
                        <div key={build.id} className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden transform transition hover:-translate-y-1">
                            <div className="p-6 md:p-8">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                                    <div>
                                        <h3 className="text-2xl md:text-3xl font-bold text-yellow-500 mb-1">{build.title}</h3>
                                        <p className="text-lg text-gray-600 dark:text-gray-300 font-medium">{build.engineMake} {build.engineModel} - {build.engineCode}</p>
                                         {build.shopName && build.shopId && (
                                            <button onClick={() => {setActivePanel('network'); setActiveShop(shopsDatabase.find(s => s.id === build.shopId) || null);}} className="mt-2 inline-flex items-center gap-2 text-sm text-blue-500 hover:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full transition">
                                                <i className="fas fa-check-circle"></i> Built by {build.shopName}
                                            </button>
                                        )}
                                    </div>
                                    <div className="mt-4 md:mt-0 flex gap-4 text-center">
                                         <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Power</div>
                                            <div className="text-xl font-bold text-green-600 dark:text-green-400">{build.horsepower || '?'} <span className="text-sm text-gray-500">HP</span></div>
                                         </div>
                                         <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Torque</div>
                                            <div className="text-xl font-bold text-green-600 dark:text-green-400">{build.torque || '?'} <span className="text-sm text-gray-500">FT/LB</span></div>
                                         </div>
                                    </div>
                                </div>

                                {build.photos && build.photos.length > 0 && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
                                        {build.photos.map((photo, idx) => (
                                            <div key={idx} className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                                                <img src={photo} alt={`Build detail ${idx}`} className="w-full h-full object-cover hover:scale-110 transition duration-500 cursor-pointer" />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="mb-8">
                                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Build Story</h4>
                                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                                        {build.description || "No description provided."}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 bg-gray-50 dark:bg-[#151515] p-6 rounded-xl">
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Build Specifications</h4>
                                        <ul className="space-y-2 text-gray-700 dark:text-gray-300 text-sm">
                                            <li className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-1"><span>Induction:</span> <span className="font-medium">{build.inductionType}</span></li>
                                            <li className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-1"><span>ECU:</span> <span className="font-medium">{build.engineManagement}</span></li>
                                            <li className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-1"><span>Injectors:</span> <span className="font-medium">{build.injectorSize}</span></li>
                                            <li className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-1"><span>Fuel Pump:</span> <span className="font-medium">{build.fuelPump}</span></li>
                                            <li className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-1"><span>Intake Manifold:</span> <span className="font-medium">{build.intakeManifoldType}</span></li>
                                            <li className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-1"><span>MLS Gasket/Spacer:</span> <span className="font-medium">{build.headGasketMod}</span></li>
                                            <li className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-1"><span>Pistons:</span> <span className="font-medium">{build.pistons}</span></li>
                                            <li className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-1"><span>Rods:</span> <span className="font-medium">{build.rods}</span></li>
                                            <li className="flex justify-between"><span>Crank:</span> <span className="font-medium">{build.crankshaft}</span></li>
                                        </ul>
                                    </div>
                                    <div className="flex items-center justify-center">
                                         {build.dynoLink ? (
                                             <a href={build.dynoLink} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center gap-3 text-red-600 hover:text-red-500 transition group">
                                                 <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center group-hover:scale-110 transition">
                                                    <i className="fab fa-youtube text-3xl"></i>
                                                 </div>
                                                 <span className="font-bold">Watch Dyno Run</span>
                                             </a>
                                         ) : (
                                             <div className="text-center text-gray-400">
                                                 <i className="fas fa-video-slash text-3xl mb-2"></i>
                                                 <p className="text-sm">No video available</p>
                                             </div>
                                         )}
                                    </div>
                                </div>

                                <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
                                     <div className="flex items-center gap-2 text-gray-500 text-sm">
                                         <i className="fas fa-calendar-alt"></i> Posted recently
                                     </div>
                                     <button onClick={() => handleLike(build.id)} className="flex items-center gap-2 px-4 py-2 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-full font-bold hover:bg-pink-200 dark:hover:bg-pink-900/50 transition">
                                         <i className="fas fa-heart"></i> Like ({build.likes || 0})
                                     </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        );
    };

    const engineDetailTabs = [
        { id: 'specs', label: 'Specs', icon: 'fa-list' },
        { id: 'aiAdvisor', label: 'AI Advisor', icon: 'fa-robot' },
        { id: 'builds', label: 'Builds', icon: 'fa-tools' },
        { id: 'compare', label: 'Compare', icon: 'fa-exchange-alt' },
        { id: 'upgrades', label: 'Upgrades', icon: 'fa-arrow-circle-up' },
        { id: 'crCalculator', label: 'CR Calc', icon: 'fa-calculator' },
    ];

    return (
        <div className="min-h-screen flex flex-col font-sans text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-[#121212]">
            {/* Edit Modal */}
            {isEditModalOpen && editingBuild && (
                <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-[#1e1e1e] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-200 dark:border-gray-700 pb-4">
                            <h2 className="text-2xl font-bold">Edit Build: {editingBuild.title}</h2>
                            <button onClick={closeEditModal} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                                <i className="fas fa-times text-xl"></i>
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div>
                                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Build Title</label>
                                    <input type="text" id="title" value={editingBuild.title} onChange={handleEditBuildChange} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900" />
                                 </div>
                                 <div>
                                     <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Dyno Link</label>
                                     <input type="text" id="dynoLink" value={editingBuild.dynoLink} onChange={handleEditBuildChange} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900" />
                                 </div>
                             </div>
                             
                             <div>
                                 <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
                                 <textarea id="description" value={editingBuild.description} onChange={handleEditBuildChange} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900 h-24" />
                             </div>
                             
                             <div>
                                 <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Photo URLs (comma separated)</label>
                                 <input type="text" id="photos" value={editingBuild.photos} onChange={handleEditBuildChange} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900" />
                             </div>
                             
                             <div className="grid grid-cols-2 gap-4">
                                <input type="text" id="horsepower" placeholder="HP" value={editingBuild.horsepower} onChange={handleEditBuildChange} className="p-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900" />
                                <input type="text" id="torque" placeholder="Torque" value={editingBuild.torque} onChange={handleEditBuildChange} className="p-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900" />
                             </div>

                             <div className="grid grid-cols-2 gap-4">
                                <input type="text" id="pistons" placeholder="Pistons" value={editingBuild.pistons} onChange={handleEditBuildChange} className="p-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900" />
                                <input type="text" id="rods" placeholder="Rods" value={editingBuild.rods} onChange={handleEditBuildChange} className="p-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900" />
                             </div>

                            {/* Edit New Fields */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="inductionType" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Induction Type</label>
                                    <select id="inductionType" value={editingBuild.inductionType || 'Naturally Aspirated'} onChange={handleEditBuildChange} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900">
                                        <option value="Naturally Aspirated">Naturally Aspirated</option>
                                        <option value="Turbocharged">Turbocharged</option>
                                        <option value="Supercharged">Supercharged</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="intakeManifoldType" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Intake Manifold</label>
                                    <select id="intakeManifoldType" value={editingBuild.intakeManifoldType || 'Stock'} onChange={handleEditBuildChange} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900">
                                        <option value="Stock">Stock</option>
                                        <option value="Aftermarket">Aftermarket</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="injectorSize" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Injector Size</label>
                                    <input type="text" id="injectorSize" value={editingBuild.injectorSize || ''} onChange={handleEditBuildChange} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900" />
                                </div>
                                <div>
                                    <label htmlFor="fuelPump" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Fuel Pump Size</label>
                                    <input type="text" id="fuelPump" value={editingBuild.fuelPump || ''} onChange={handleEditBuildChange} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="engineManagement" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Engine Management</label>
                                    <input type="text" id="engineManagement" value={editingBuild.engineManagement || ''} onChange={handleEditBuildChange} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900" />
                                </div>
                                <div>
                                    <label htmlFor="headGasketMod" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">MLS Gasket/Spacer/O-Ring</label>
                                    <select id="headGasketMod" value={editingBuild.headGasketMod || 'No'} onChange={handleEditBuildChange} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900">
                                        <option value="No">No (Stock)</option>
                                        <option value="Yes">Yes (Upgraded)</option>
                                    </select>
                                </div>
                            </div>

                             <div>
                                <label htmlFor="shopId" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Work Performed By</label>
                                <select
                                    id="shopId"
                                    value={editingBuild.shopId || ''}
                                    onChange={handleEditBuildChange}
                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
                                >
                                    <option value="">-- Select a Shop --</option>
                                    {shopsDatabase.map(shop => (
                                        <option key={shop.id} value={shop.id}>{shop.name}</option>
                                    ))}
                                </select>
                            </div>

                             <div className="flex gap-3 pt-4">
                                 <button onClick={saveEditedBuild} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg">Save Changes</button>
                                 <button onClick={closeEditModal} className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold rounded-lg">Cancel</button>
                             </div>
                        </div>
                    </div>
                </div>
            )}

            <header className="bg-white dark:bg-[#1e1e1e] shadow-md py-2 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <div className="text-center w-full relative">
                         <img src="https://lh3.googleusercontent.com/d/1gQSxE5LLviQRWwxre27-dRSA_xvRydQ2" alt="Altrous TunerSpecs Pro Logo" className="max-w-full h-auto block mx-auto w-4/5 md:w-3/5 lg:w-2/5" style={{ marginBottom: '0px' }} />
                         <h1 className="text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto my-0 whitespace-nowrap">Select a car make, model, and engine to view detailed technical specifications and compare engines</h1>
                         
                         {/* Pro Toggle Button (Simulation) */}
                         <button 
                            onClick={toggleProMode}
                            className={`absolute right-0 top-1/2 -translate-y-1/2 text-xs font-bold px-3 py-1 rounded-full border transition ${isPro ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-500' : 'bg-gray-200 text-gray-600 border-gray-300 hover:bg-gray-300'}`}
                        >
                            {isPro ? 'PRO MODE' : 'FREE MODE'}
                         </button>
                    </div>
                    <button onClick={toggleTheme} className="absolute right-4 top-4 p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white">
                        <i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i>
                    </button>
                </div>
            </header>

            <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-2">
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Left Sidebar - Selection Panel */}
                    <aside className="w-full lg:w-1/4">
                        <div className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700 sticky top-24">
                            <div className="flex items-center gap-2 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
                                <i className="fas fa-car text-blue-500"></i>
                                <h2 className="font-bold text-lg text-gray-800 dark:text-white">Vehicle Selection</h2>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Make</label>
                                    <select
                                        value={selectedMake}
                                        onChange={handleMakeChange}
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                    >
                                        <option value="">-- Select Make --</option>
                                        {makes.map((make) => (
                                            <option key={make} value={make}>{make}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model</label>
                                    <select
                                        value={selectedModel}
                                        onChange={handleModelChange}
                                        disabled={!selectedMake}
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <option value="">-- Select Model --</option>
                                        {models.map((model) => (
                                            <option key={model} value={model}>{model}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Engine</label>
                                    <select
                                        value={selectedEngineCode}
                                        onChange={handleEngineChange}
                                        disabled={!selectedModel}
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <option value="">-- Select Engine --</option>
                                        {engines.map((engine, index) => (
                                            <option key={index} value={engine.engineCode}>{engine.engineCode} ({engine.displacement}L)</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            {/* Feedback input field */}
                            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                                <a 
                                    href="mailto:tunerspecs@gmail.com?subject=TunerSpecs%20Pro%20-%20Data%20Correction%2FSuggestion&body=Type%20of%20Request%20(Missing%20Engine%2C%20Incorrect%20Spec%2C%20Other)%3A%0A%0AMake%2C%20Model%2C%20Engine%20Code%3A%0A%0ADetails%20of%20correction%20or%20suggestion%3A%0A%0ASource%2FReference%20(optional)%3A"
                                    className="block w-full relative group"
                                >
                                    <div className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-500 dark:text-gray-400 group-hover:border-blue-400 dark:group-hover:border-blue-500 group-hover:text-blue-500 transition-all cursor-pointer flex items-center justify-between">
                                        <span>See something wrong? Let us know</span>
                                        <i className="fas fa-arrow-right opacity-0 group-hover:opacity-100 transition-opacity"></i>
                                    </div>
                                </a>
                            </div>
                        </div>
                    </aside>

                    {/* Right Content - Main Content Tabs/Panels */}
                    <div className="w-full lg:w-3/4">
                        <div className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 min-h-[600px] flex flex-col">
                            {/* Tab Navigation */}
                            <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                                <button
                                    onClick={() => setActivePanel('engineDetails')}
                                    className={`flex-1 py-4 px-6 font-bold text-sm md:text-base transition whitespace-nowrap flex items-center justify-center gap-2 rounded-tl-xl ${activePanel === 'engineDetails' ? 'text-gray-800 dark:text-white border-b-2 border-blue-500 bg-gray-50 dark:bg-gray-800' : 'text-gray-500 dark:text-gray-400 hover:text-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-tl-xl'}`}
                                >
                                    <i className="fas fa-cogs"></i> Engine Details
                                </button>
                                <button
                                    onClick={() => setActivePanel('myGarage')}
                                    className={`flex-1 py-4 px-6 font-bold text-sm md:text-base transition whitespace-nowrap flex items-center justify-center gap-2 ${activePanel === 'myGarage' ? 'text-gray-800 dark:text-white border-b-2 border-blue-500 bg-gray-50 dark:bg-gray-800' : 'text-gray-500 dark:text-gray-400 hover:text-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                                >
                                    <i className="fas fa-warehouse"></i> My Garage
                                </button>
                                <button
                                    onClick={() => setActivePanel('showcase')}
                                    className={`flex-1 py-4 px-6 font-bold text-sm md:text-base transition whitespace-nowrap flex items-center justify-center gap-2 ${activePanel === 'showcase' ? 'text-gray-800 dark:text-white border-b-2 border-blue-500 bg-gray-50 dark:bg-gray-800' : 'text-gray-500 dark:text-gray-400 hover:text-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                                >
                                    <i className="fas fa-trophy"></i> Showcase
                                </button>
                                <button
                                    onClick={() => setActivePanel('network')}
                                    className={`flex-1 py-4 px-6 font-bold text-sm md:text-base transition whitespace-nowrap flex items-center justify-center gap-2 rounded-tr-xl ${activePanel === 'network' ? 'text-gray-800 dark:text-white border-b-2 border-blue-500 bg-gray-50 dark:bg-gray-800' : 'text-gray-500 dark:text-gray-400 hover:text-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-tr-xl'}`}
                                >
                                    <i className="fas fa-handshake"></i> Network
                                </button>
                            </div>

                            {/* Panel Content */}
                            <div className="p-6 md:p-8 flex-grow">
                                {activePanel === 'engineDetails' && (
                                    <div className="flex flex-col h-full">
                                        {/* Sub-tabs for Engine Details */}
                                        <div className="flex flex-wrap gap-2 mb-6 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                            {engineDetailTabs.map(tab => (
                                                <button
                                                    key={tab.id}
                                                    onClick={() => setActiveTab(tab.id)}
                                                    className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition flex items-center justify-center gap-2 ${activeTab === tab.id ? 'bg-white dark:bg-[#1e1e1e] text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                                                >
                                                    <i className={`fas ${tab.icon}`}></i> <span className="hidden md:inline">{tab.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                        
                                        <div className="flex-grow">
                                            {activeTab === 'specs' && renderSpecs()}
                                            {activeTab === 'aiAdvisor' && renderAiAdvisor()}
                                            {activeTab === 'builds' && renderBuilds()}
                                            {activeTab === 'compare' && renderCompare()}
                                            {activeTab === 'upgrades' && renderUpgrades()}
                                            {activeTab === 'crCalculator' && renderCRCalculator()}
                                        </div>
                                    </div>
                                )}

                                {activePanel === 'myGarage' && renderGarage()}
                                {activePanel === 'showcase' && renderShowcase()}
                                {activePanel === 'network' && renderNetwork()}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="bg-white dark:bg-[#1e1e1e] border-t border-gray-200 dark:border-gray-800 py-6 mt-auto">
                <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                    <p>&copy; {new Date().getFullYear()} Altrous TunerSpecs Pro. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default App;