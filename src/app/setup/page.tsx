'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  CheckCircle, 
  ChevronRight, 
  Server, 
  Monitor, 
  Database, 
  Key, 
  Store,
  MonitorSmartphone,
  Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CustomerRegistrationService } from '@/services/registration/CustomerRegistrationService';

export default function SetupWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isCheckingSystem, setIsCheckingSystem] = useState(false);
  const [systemStatus, setSystemStatus] = useState({ os: null, memory: null, storage: null } as any);
  
  // Login State
  const [trialId, setTrialId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  // Branch & Terminal State
  const [branch, setBranch] = useState('');
  const [terminal, setTerminal] = useState('');
  const [isActivating, setIsActivating] = useState(false);

  // MOCK SYSTEM CHECK
  const runSystemCheck = () => {
    setIsCheckingSystem(true);
    setTimeout(() => {
      setSystemStatus({ os: 'Windows 11', memory: '16GB (Pass)', storage: '45GB Free (Pass)' });
      setIsCheckingSystem(false);
    }, 1500);
  };

  useEffect(() => {
    if (step === 2) {
      runSystemCheck();
    }
  }, [step]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsAuthenticating(true);
    
    // MOCK LOGIN VALIDATION
    setTimeout(() => {
      if (trialId && username && password) {
        setIsAuthenticating(false);
        setStep(4);
      } else {
        setIsAuthenticating(false);
        setLoginError('Invalid Trial ID or Credentials');
      }
    }, 1000);
  };

  const handleActivation = async () => {
    setIsActivating(true);
    // MOCK ACTIVATION
    setTimeout(() => {
      setIsActivating(false);
      setStep(5);
    }, 1500);
  };

  const completeSetup = () => {
    // Navigate to login or directly into POS
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[500px]">
        
        {/* Left Sidebar - Progress */}
        <div className="w-full md:w-64 bg-slate-50 border-r border-slate-200 p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-8">
            <div className="h-8 w-8 bg-amber-500 rounded flex items-center justify-center font-bold text-white shadow">
              T
            </div>
            <span className="font-extrabold text-slate-800 tracking-wide text-lg">TRIWYN POS</span>
          </div>
          
          <div className="flex-1 space-y-6">
            <StepIndicator currentStep={step} stepNumber={1} label="Welcome" />
            <StepIndicator currentStep={step} stepNumber={2} label="System Check" />
            <StepIndicator currentStep={step} stepNumber={3} label="Authentication" />
            <StepIndicator currentStep={step} stepNumber={4} label="Device Activation" />
            <StepIndicator currentStep={step} stepNumber={5} label="Ready" />
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 p-8 flex flex-col">
          
          {step === 1 && (
            <div className="flex-1 flex flex-col justify-center animate-in fade-in zoom-in duration-300">
              <div className="h-20 w-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 mx-auto">
                <Store className="h-10 w-10" />
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900 text-center mb-2">Welcome to TRIWYN</h2>
              <p className="text-slate-500 text-center mb-8">
                Let's set up your POS terminal in a few simple steps. You will need your Trial ID or Subscription details.
              </p>
              <Button size="lg" onClick={() => setStep(2)} className="w-full sm:w-auto mx-auto font-bold bg-slate-900 hover:bg-slate-800 text-white">
                Start Setup <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="flex-1 flex flex-col animate-in slide-in-from-right-4 duration-300">
              <h2 className="text-2xl font-extrabold text-slate-900 mb-6">System Check</h2>
              <p className="text-slate-600 mb-6">Verifying that your system meets the requirements to run TRIWYN POS reliably.</p>
              
              <div className="space-y-4 flex-1">
                <SystemCheckItem icon={<Monitor className="h-5 w-5 text-blue-500" />} label="Operating System" status={systemStatus.os} loading={isCheckingSystem} />
                <SystemCheckItem icon={<Server className="h-5 w-5 text-purple-500" />} label="System Memory (RAM)" status={systemStatus.memory} loading={isCheckingSystem} />
                <SystemCheckItem icon={<Database className="h-5 w-5 text-amber-500" />} label="Storage Capacity" status={systemStatus.storage} loading={isCheckingSystem} />
              </div>
              
              <div className="mt-8 flex justify-end">
                <Button onClick={() => setStep(3)} disabled={isCheckingSystem} className="bg-slate-900 hover:bg-slate-800 text-white">
                  Continue <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex-1 flex flex-col animate-in slide-in-from-right-4 duration-300">
              <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Authentication</h2>
              <p className="text-slate-600 mb-6">Enter the credentials provided during your registration to link this device.</p>
              
              <form onSubmit={handleLogin} className="flex-1 space-y-4">
                {loginError && (
                  <div className="bg-rose-50 text-rose-600 p-3 rounded-md text-sm font-semibold border border-rose-200">
                    {loginError}
                  </div>
                )}
                
                <div className="space-y-2">
                  <label htmlFor="trialId" className="font-bold text-slate-700 block">Trial / Subscription ID</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                    <Input 
                      id="trialId" 
                      placeholder="e.g. TRIAL-XXXXXX" 
                      className="pl-10 font-mono"
                      value={trialId}
                      onChange={(e) => setTrialId(e.target.value)}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="username" className="font-bold text-slate-700 block">Admin Username</label>
                  <Input 
                    id="username" 
                    placeholder="Enter your username" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="password" className="font-bold text-slate-700 block">Password</label>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="pt-4 flex justify-between items-center mt-auto">
                  <Button type="button" variant="ghost" onClick={() => setStep(2)}>Back</Button>
                  <Button type="submit" disabled={isAuthenticating} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow">
                    {isAuthenticating ? 'Authenticating...' : 'Authenticate'}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {step === 4 && (
            <div className="flex-1 flex flex-col animate-in slide-in-from-right-4 duration-300">
              <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Device Activation</h2>
              <p className="text-slate-600 mb-6">Assign this device to a specific branch and terminal register.</p>
              
              <div className="flex-1 space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-2">
                  <div className="flex items-center gap-2 text-blue-800 font-bold mb-1">
                    <CheckCircle className="h-5 w-5" />
                    Authentication Successful
                  </div>
                  <p className="text-sm text-blue-600 font-medium">Organization: Infinity Enterprises</p>
                  <p className="text-sm text-blue-600 font-medium">Plan: POS Free Trial (Active)</p>
                </div>

                <div className="space-y-2">
                  <label className="font-bold text-slate-700 block">Select Branch</label>
                  <select 
                    value={branch} 
                    onChange={(e) => setBranch(e.target.value)}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="" disabled>Choose a branch location</option>
                    <option value="main">Main Store - Downtown</option>
                    <option value="warehouse">Warehouse Outlet</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="font-bold text-slate-700 block">Assign Terminal Name</label>
                  <select 
                    value={terminal} 
                    onChange={(e) => setTerminal(e.target.value)}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="" disabled>Choose a terminal</option>
                    <option value="reg1">Register 01 (Front Desk)</option>
                    <option value="reg2">Register 02 (Counter)</option>
                  </select>
                </div>
              </div>

              <div className="pt-8 flex justify-between items-center mt-auto">
                <Button type="button" variant="ghost" onClick={() => setStep(3)}>Back</Button>
                <Button 
                  type="button" 
                  disabled={!branch || !terminal || isActivating} 
                  onClick={handleActivation}
                  className="bg-amber-500 hover:bg-amber-600 text-white shadow font-bold"
                >
                  {isActivating ? 'Activating License...' : 'Activate Device'}
                </Button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="flex-1 flex flex-col justify-center items-center animate-in zoom-in duration-500 text-center">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-emerald-200 rounded-full animate-ping opacity-75"></div>
                <div className="relative h-24 w-24 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg">
                  <CheckCircle className="h-12 w-12" />
                </div>
              </div>
              
              <h2 className="text-3xl font-extrabold text-slate-900 mb-2">Setup Complete!</h2>
              <p className="text-slate-500 mb-2">
                This device has been successfully registered and activated.
              </p>
              
              <div className="bg-slate-100 rounded-lg p-4 border border-slate-200 w-full mb-8 mt-4 text-left">
                <div className="flex justify-between border-b border-slate-200 pb-2 mb-2">
                  <span className="text-sm font-semibold text-slate-500">Device ID</span>
                  <span className="font-mono text-sm font-bold text-slate-900">DEV-98XQ2</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2 mb-2">
                  <span className="text-sm font-semibold text-slate-500">Branch</span>
                  <span className="text-sm font-bold text-slate-900">Main Store - Downtown</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-semibold text-slate-500">Terminal</span>
                  <span className="text-sm font-bold text-slate-900">Register 01</span>
                </div>
              </div>

              <Button size="lg" onClick={completeSetup} className="w-full bg-slate-900 hover:bg-slate-800 text-white shadow-lg font-bold text-lg h-14">
                <Play className="mr-2 h-6 w-6" />
                Launch POS System
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function StepIndicator({ currentStep, stepNumber, label }: { currentStep: number, stepNumber: number, label: string }) {
  const isCompleted = currentStep > stepNumber;
  const isCurrent = currentStep === stepNumber;
  const isPending = currentStep < stepNumber;

  return (
    <div className={`flex items-center gap-3 ${isPending ? 'opacity-50' : 'opacity-100'}`}>
      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm transition-colors duration-300
        ${isCompleted ? 'bg-emerald-500 text-white' : 
          isCurrent ? 'bg-slate-900 text-white ring-4 ring-slate-200' : 
          'bg-white border-2 border-slate-300 text-slate-500'}`}
      >
        {isCompleted ? <CheckCircle className="h-5 w-5" /> : stepNumber}
      </div>
      <span className={`text-sm font-bold ${isCurrent ? 'text-slate-900' : 'text-slate-500'}`}>
        {label}
      </span>
    </div>
  );
}

function SystemCheckItem({ icon, label, status, loading }: { icon: React.ReactNode, label: string, status: string | null, loading: boolean }) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="bg-white p-2 rounded-md shadow-sm border border-slate-100">
          {icon}
        </div>
        <span className="font-bold text-slate-700">{label}</span>
      </div>
      <div>
        {loading ? (
          <div className="h-5 w-5 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin"></div>
        ) : status ? (
          <span className="flex items-center text-emerald-600 font-bold text-sm bg-emerald-50 px-2 py-1 rounded">
            <CheckCircle className="h-4 w-4 mr-1.5" />
            {status}
          </span>
        ) : (
          <span className="text-slate-400 text-sm font-medium">Pending...</span>
        )}
      </div>
    </div>
  );
}
