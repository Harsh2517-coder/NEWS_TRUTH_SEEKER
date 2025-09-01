from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import sys
import os
from langdetect import detect
from werkzeug.utils import secure_filename
import PyPDF2
from io import BytesIO

# Add project root to Python path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

# Import our utility functions
from utils.news_utils import (
    extract_article, 
    translate_to_english, 
    analyze_bias,
    sentence_tone_breakdown, 
    get_source_reliability_score,
    detect_political_leaning
)

app = Flask(__name__)
CORS(app)

# Configuration
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['UPLOAD_FOLDER'] = 'uploads'
ALLOWED_EXTENSIONS = {'txt', 'pdf'}

# Create uploads directory if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route("/")
def index():
    """Serve the main page"""
    return render_template('index.html')

@app.route("/api/analyze", methods=["POST"])
def analyze():
    """Main analysis endpoint"""
    try:
        data = request.get_json()
        
        # Handle manual text input
        if data.get("manual"):
            text = data.get("text", "")
            title = data.get("title", "Untitled")
            
            if not text.strip():
                return jsonify({"error": "No text provided"}), 400
                
            try:
                lang = detect(text)
            except:
                lang = "en"
                
            translated_text = translate_to_english(text, lang) if lang != "en" else text
            
        else:
            # Handle URL-based analysis
            url = data.get("url")
            if not url:
                return jsonify({"error": "URL is required"}), 400

            article_data = extract_article(url)
            if "error" in article_data:
                return jsonify({"error": f"Article extraction failed: {article_data['error']}"}), 500

            text = article_data["text"]
            title = article_data["title"]
            lang = article_data["language"]
            translated_text = translate_to_english(text, lang)

        # Perform analysis
        bias_data = analyze_bias(translated_text)
        if "error" in bias_data:
            return jsonify({"error": f"Bias analysis failed: {bias_data['error']}"}), 500
            
        political_scores = detect_political_leaning(translated_text)
        tone_data = sentence_tone_breakdown(translated_text)
        
        # Get source reliability for URL-based analysis
        if not data.get("manual"):
            score_info = get_source_reliability_score(data.get("url"))
        else:
            score_info = {"score": "N/A", "label": "Manual Input"}

        return jsonify({
            "success": True,
            "title": title,
            "language": lang,
            "text": text,
            "translated_text": translated_text if lang != "en" else None,
            "bias_analysis": bias_data,
            "tone_breakdown": tone_data,
            "source_reliability": score_info,
            "political_leaning": political_scores,
        })

    except Exception as e:
        return jsonify({"error": f"Analysis failed: {str(e)}"}), 500

@app.route("/api/upload", methods=["POST"])
def upload_file():
    """Handle file upload"""
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
            
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            file_content = file.read()
            
            # Extract text based on file type
            text = ""
            if filename.endswith('.txt'):
                text = file_content.decode('utf-8')
            elif filename.endswith('.pdf'):
                pdf_reader = PyPDF2.PdfReader(BytesIO(file_content))
                for page in pdf_reader.pages:
                    text += page.extract_text()
            
            if not text.strip():
                return jsonify({"error": "Could not extract text from file"}), 400
                
            return jsonify({
                "success": True,
                "text": text,
                "filename": filename
            })
        else:
            return jsonify({"error": "Invalid file type. Only .txt and .pdf files are allowed"}), 400
            
    except Exception as e:
        return jsonify({"error": f"File upload failed: {str(e)}"}), 500

@app.errorhandler(413)
def too_large(e):
    return jsonify({"error": "File too large. Maximum size is 16MB"}), 413

@app.errorhandler(404)
def not_found(e):
    return render_template('404.html'), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500

# if __name__ == "__main__":
#     print("Flask server starting...")
#     app.run(debug=True, host="0.0.0.0", port=5000)