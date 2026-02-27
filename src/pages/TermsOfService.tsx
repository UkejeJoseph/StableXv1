import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const TermsOfService = () => {
    return (
        <div className="min-h-screen bg-background text-foreground p-6 md:p-12 font-sans relative z-10">
            <div className="max-w-3xl mx-auto space-y-8">
                <Link to="/" className="inline-flex items-center text-primary hover:text-primary/80 transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Home
                </Link>

                <div className="space-y-4">
                    <h1 className="text-4xl font-bold tracking-tight text-gradient">Terms of Service</h1>
                    <p className="text-muted-foreground">Last Updated: October 2026</p>
                </div>

                <div className="space-y-6 prose prose-invert max-w-none text-sm md:text-base text-gray-300">
                    <section className="space-y-3">
                        <h2 className="text-2xl font-semibold text-white">1. Acceptance of Terms</h2>
                        <p>
                            By accessing or using the StableX mobile application and web platform ("StableX", "we", "us", or "our"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-2xl font-semibold text-white">2. Risk Disclosure</h2>
                        <p>
                            Trading and holding cryptocurrency involves significant risk and can result in the loss of your invested capital. You should not invest more than you can afford to lose and should ensure that you fully understand the risks involved. By using StableX, you acknowledge that we are not responsible for any financial losses incurred.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-2xl font-semibold text-white">3. Account Registration & Security</h2>
                        <p>
                            To use certain features of StableX, you must register for an account. You agree to provide accurate, current, and complete information during the registration process. You are completely responsible for safeguarding the password and any private keys or recovery phrases that you use to access the service.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-2xl font-semibold text-white">4. Prohibited Activities</h2>
                        <p>
                            You may not use the StableX platform to engage in any illegal activities, including but not limited to money laundering, terrorist financing, fraud, or tax evasion. We reserve the right to suspend or terminate any account involved in suspicious activity.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-2xl font-semibold text-white">5. Intellectual Property</h2>
                        <p>
                            The StableX service and its original content, features, and functionality are and will remain the exclusive property of StableX and its licensors. Our trademarks and trade dress may not be used in connection with any product or service without our prior written consent.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-2xl font-semibold text-white">6. Limitation of Liability</h2>
                        <p>
                            In no event shall StableX, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default TermsOfService;
