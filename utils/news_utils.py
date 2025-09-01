import requests
from bs4 import BeautifulSoup
from langdetect import detect
from textblob import TextBlob
import re
from urllib.parse import urlparse
import time

def extract_article(url):
    """Extract article content from URL using web scraping"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer", "aside", "header"]):
            script.decompose()
        
        # Try to find the main content
        title = ""
        text = ""
        
        # Extract title
        title_selectors = [
            'h1',
            '.headline',
            '.title',
            '[class*="headline"]',
            '[class*="title"]',
            'title'
        ]
        
        for selector in title_selectors:
            title_elem = soup.select_one(selector)
            if title_elem and len(title_elem.get_text().strip()) > 5:
                title = title_elem.get_text().strip()
                break
        
        # Extract main content
        content_selectors = [
            'article',
            '.article-content',
            '.content',
            '.post-content',
            '.story-body',
            '[class*="article"]',
            '[class*="content"]',
            '[class*="story"]',
            '.entry-content',
            'main'
        ]
        
        for selector in content_selectors:
            content_elem = soup.select_one(selector)
            if content_elem:
                # Get all paragraphs within the content
                paragraphs = content_elem.find_all('p')
                if paragraphs:
                    text = ' '.join([p.get_text().strip() for p in paragraphs if len(p.get_text().strip()) > 20])
                    if len(text) > 200:  # Only use if we got substantial content
                        break
        
        # Fallback: get all paragraphs from the page
        if not text or len(text) < 200:
            paragraphs = soup.find_all('p')
            text = ' '.join([p.get_text().strip() for p in paragraphs if len(p.get_text().strip()) > 20])
        
        # Clean up text
        text = re.sub(r'\s+', ' ', text).strip()
        title = re.sub(r'\s+', ' ', title).strip()
        
        if not title:
            title = "Extracted Article"
        
        if not text or len(text) < 100:
            return {"error": "Could not extract sufficient content from the article"}
        
        # Detect language
        try:
            language = detect(text)
        except:
            language = "en"
        
        return {
            "title": title,
            "text": text,
            "language": language,
            "url": url
        }
        
    except requests.exceptions.RequestException as e:
        return {"error": f"Failed to fetch URL: {str(e)}"}
    except Exception as e:
        return {"error": f"Failed to extract article: {str(e)}"}

def translate_to_english(text, source_lang):
    """Simple translation placeholder - in production, use Google Translate API or similar"""
    if source_lang == "en":
        return text
    
    # This is a placeholder - in production, integrate with Google Translate API
    # For now, we'll just return the original text with a note
    return text

def analyze_bias(text):
    """Analyze bias in text using TextBlob and custom rules"""
    try:
        blob = TextBlob(text)
        polarity = blob.sentiment.polarity
        subjectivity = blob.sentiment.subjectivity
        
        # Enhanced bias classification
        if subjectivity < 0.3:
            if abs(polarity) < 0.1:
                bias_label = "Neutral"
            elif polarity < -0.2:
                bias_label = "Left-Leaning"
            elif polarity > 0.2:
                bias_label = "Right-Leaning"
            else:
                bias_label = "Moderate"
        else:
            # High subjectivity articles
            if polarity < -0.3:
                bias_label = "Left-Leaning"
            elif polarity > 0.3:
                bias_label = "Right-Leaning"
            elif abs(polarity) < 0.1:
                bias_label = "Opinionated Neutral"
            else:
                bias_label = "Moderate"
        
        # Add confidence score
        confidence = min(1.0, abs(polarity) + subjectivity)
        
        return {
            "bias": bias_label,
            "polarity": round(polarity, 3),
            "subjectivity": round(subjectivity, 3),
            "confidence": round(confidence, 3)
        }
    except Exception as e:
        return {"error": str(e)}

def sentence_tone_breakdown(text):
    """Analyze tone of individual sentences with political keyword detection"""
    try:
        # Enhanced political keywords
        political_keywords = {
            "parties": ["BJP", "Congress", "AAP", "Aam Aadmi Party", "NDA", "UPA", "RSS"],
            "leaders": ["Modi", "Narendra Modi", "Rahul Gandhi", "Arvind Kejriwal", "Sonia Gandhi"],
            "terms": ["government", "opposition", "politics", "election", "democracy", "parliament"]
        }
        
        # Split into sentences more accurately
        sentences = re.split(r'[.!?]+', text)
        breakdown = []
        
        for sentence in sentences[:15]:  # Analyze first 15 sentences
            sentence = sentence.strip()
            if len(sentence) < 20:  # Skip very short sentences
                continue
                
            try:
                blob = TextBlob(sentence)
                polarity = blob.sentiment.polarity
                subjectivity = blob.sentiment.subjectivity
                
                # Find political mentions
                mentions = []
                sentence_lower = sentence.lower()
                
                for category, keywords in political_keywords.items():
                    for keyword in keywords:
                        if keyword.lower() in sentence_lower:
                            mentions.append(keyword)
                
                # Remove duplicates
                mentions = list(set(mentions))
                
                breakdown.append({
                    "sentence": sentence,
                    "polarity": round(polarity, 3),
                    "subjectivity": round(subjectivity, 3),
                    "mentions": mentions,
                    "word_count": len(sentence.split())
                })
            except:
                continue
        
        return breakdown
    except Exception as e:
        return []

def get_source_reliability_score(url):
    """Enhanced source reliability scoring based on domain reputation"""
    try:
        domain = urlparse(url).netloc.lower()
        domain = domain.replace('www.', '')
        
        # Enhanced reliability database
        reliability_scores = {
            # International News
            "reuters.com": {"score": 92, "label": "Highly Reliable"},
            "ap.org": {"score": 90, "label": "Highly Reliable"},
            "bbc.com": {"score": 88, "label": "Highly Reliable"},
            "npr.org": {"score": 87, "label": "Highly Reliable"},
            "pbs.org": {"score": 86, "label": "Highly Reliable"},
            
            # Indian News Sources
            "thehindu.com": {"score": 85, "label": "Reliable"},
            "indianexpress.com": {"score": 82, "label": "Reliable"},
            "livemint.com": {"score": 80, "label": "Reliable"},
            "business-standard.com": {"score": 79, "label": "Reliable"},
            "scroll.in": {"score": 78, "label": "Reliable"},
            
            # Major International
            "cnn.com": {"score": 75, "label": "Generally Reliable"},
            "nytimes.com": {"score": 83, "label": "Reliable"},
            "washingtonpost.com": {"score": 81, "label": "Reliable"},
            "theguardian.com": {"score": 80, "label": "Reliable"},
            
            # Mixed/Lower Reliability
            "foxnews.com": {"score": 65, "label": "Mixed Reliability"},
            "ndtv.com": {"score": 72, "label": "Generally Reliable"},
            "timesofindia.indiatimes.com": {"score": 70, "label": "Generally Reliable"},
            "hindustantimes.com": {"score": 73, "label": "Generally Reliable"},
            "india.com": {"score": 60, "label": "Mixed Reliability"},
            "republicworld.com": {"score": 55, "label": "Mixed Reliability"},
            
            # Questionable
            "opindia.com": {"score": 45, "label": "Questionable"},
            "altnews.in": {"score": 75, "label": "Generally Reliable"},
        }
        
        # Check for exact match first
        if domain in reliability_scores:
            return reliability_scores[domain]
        
        # Check for partial matches (subdomains)
        for known_domain, score_info in reliability_scores.items():
            if known_domain in domain or domain in known_domain:
                return score_info
        
        # Default for unknown sources
        return {"score": "Unknown", "label": "Source Not Evaluated"}
        
    except Exception as e:
        return {"score": "Unknown", "label": "Error in Assessment"}

def detect_political_leaning(text):
    """Enhanced political sentiment analysis with more sophisticated detection"""
    try:
        # Enhanced political entity mapping
        political_entities = {
            "BJP": {
                "keywords": ["BJP", "Bharatiya Janata Party", "Modi", "Narendra Modi", "NDA", "RSS", "Amit Shah"],
                "context_words": ["hindu", "nationalism", "development", "digital india"]
            },
            "Congress": {
                "keywords": ["Congress", "Indian National Congress", "Rahul Gandhi", "Sonia Gandhi", "UPA", "Priyanka Gandhi"],
                "context_words": ["secular", "inclusive", "welfare", "minority"]
            },
            "AAP": {
                "keywords": ["AAP", "Aam Aadmi Party", "Arvind Kejriwal", "Manish Sisodia"],
                "context_words": ["corruption", "common man", "education", "healthcare"]
            }
        }
        
        results = {}
        
        for party, entity_data in political_entities.items():
            party_sentences = []
            
            # Find sentences mentioning the party
            for keyword in entity_data["keywords"]:
                pattern = r'([^.!?]*\b' + re.escape(keyword) + r'\b[^.!?]*[.!?])'
                matches = re.findall(pattern, text, re.IGNORECASE)
                party_sentences.extend(matches)
            
            if party_sentences:
                # Calculate sentiment for each sentence
                sentiments = []
                for sentence in party_sentences:
                    try:
                        blob = TextBlob(sentence)
                        sentiment = blob.sentiment.polarity
                        
                        # Weight by sentence length and relevance
                        words = len(sentence.split())
                        weight = min(1.0, words / 20)  # Longer sentences get more weight
                        
                        sentiments.append(sentiment * weight)
                    except:
                        continue
                
                if sentiments:
                    avg_sentiment = sum(sentiments) / len(sentiments)
                    results[party] = round(avg_sentiment, 3)
        
        return results
        
    except Exception as e:
        return {}