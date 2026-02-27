import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const PrivacyPolicy = () => {
    return (
        <div className="min-h-screen bg-background text-foreground p-6 md:p-12 font-sans relative z-10">
            <div className="max-w-3xl mx-auto space-y-8">
                <Link to="/" className="inline-flex items-center text-primary hover:text-primary/80 transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Home
                </Link>

                <div className="space-y-4">
                    <h1 className="text-4xl font-bold tracking-tight text-gradient">Privacy Policy</h1>
                    <p className="text-muted-foreground">Last Updated: October 2026</p>
                </div>

                <div className="space-y-6 prose prose-invert max-w-none text-sm md:text-base text-gray-300">
                    <section className="space-y-3">
                        <h2 className="text-2xl font-semibold text-white">1. Information We Collect</h2>
                        <p>
                            At StableX, we collect information to provide better services to our users. The types of personal information we collect include:
                        </p>
                        <ul className="list-disc pl-6 space-y-1">
                            <li><strong>Contact Information:</strong> Name, email address, and phone number when you register.</li>
                            <li><strong>Account Data:</strong> Cryptocurrency wallet addresses and transaction history.</li>
                            <li><strong>Device & Usage Data:</strong> IP addresses, browser types, and interaction metrics on our platform.</li>
                        </ul>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-2xl font-semibold text-white">2. How We Use Your Information</h2>
                        <p>
                            We use the collected data for various purposes, including:
                        </p>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>To provide and maintain the StableX service.</li>
                            <li>To notify you about changes to our functionality.</li>
                            <li>To provide customer support and identity verification (KYC/AML).</li>
                            <li>To gather analysis or valuable information so that we can improve our applications.</li>
                            <li>To detect, prevent and address technical issues or fraudulent activities.</li>
                        </ul>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-2xl font-semibold text-white">3. Information Sharing and Disclosure</h2>
                        <p>
                            We do not sell your personal information. We may share your information with trusted third-party service providers who assist us in operating our platform, conducting our business, or servicing you, so long as those parties agree to keep this information confidential and comply with data protection regulations. We may also disclose your information when we believe release is appropriate to comply with the law.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-2xl font-semibold text-white">4. Data Security</h2>
                        <p>
                            The security of your data is important to us, but remember that no method of transmission over the Internet, or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your Personal Data, we cannot guarantee its absolute security.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-2xl font-semibold text-white">5. Your Data Rights</h2>
                        <p>
                            Depending on your location, you may have the right to access, update, or delete the personal information we have on you. If you wish to be informed what Personal Data we hold about you and if you want it to be removed from our systems, please contact our support team.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
