'use client';

import { Github, Youtube, Mail, Phone, User } from 'lucide-react';
import Link from 'next/link';

/**
 * Footer Component - Displays social links and contact information
 */
export function Footer() {
  return (
    <footer className="border-t bg-background mt-auto">
      <div className="container mx-auto px-6 py-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Social Links */}
          <div className="flex items-center gap-4">
            <Link
              href="https://github.com/fourtytwo42/healthChains"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="h-4 w-4" />
              <span className="text-xs">GitHub</span>
            </Link>
            <Link
              href="https://www.youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Youtube className="h-4 w-4" />
              <span className="text-xs">YouTube</span>
            </Link>
          </div>

          {/* Contact Information */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              <span>Eric Henderson</span>
            </div>
            <a
              href="tel:+12178482206"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Phone className="h-3.5 w-3.5" />
              <span>(217) 848-2206</span>
            </a>
            <a
              href="mailto:henderson.1983@gmail.com"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Mail className="h-3.5 w-3.5" />
              <span>henderson.1983@gmail.com</span>
            </a>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t text-center text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} HealthChains. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

