from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import cv2
import numpy as np
from PIL import Image
from diffusers import StableDiffusionInpaintPipeline
import torch
import os
from datetime import datetime

# Initialize Flask app
app = Flask(_name_)
CORS(app)  # Enable CORS for all routes

# Global variables
pipe = None
DEVICE = None
OUTPUT_DIR = "output"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Initialize device
if torch.cuda.is_available():
    DEVICE = "cuda"
elif torch.backends.mps.is_available():
    DEVICE = "mps"
else:
    DEVICE = "cpu"

print(f"Using device: {DEVICE}")

# Initialize pipeline
print("Initializing Stable Diffusion pipeline...")
pipe = StableDiffusionInpaintPipeline.from_pretrained(
    "stabilityai/stable-diffusion-2-inpainting",
    torch_dtype=torch.float16 if DEVICE != "cpu" else torch.float32,
    cache_dir="./models/stable_diffusion_inpainting"
)
pipe.to(DEVICE)
print("Pipeline initialization complete!")

def generate_unique_filename():
    """Generate a unique filename using timestamp"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"inpainted_{timestamp}.png"

@app.route('/inpaint', methods=['POST'])
def inpaint():
    try:
        if 'image' not in request.files or 'mask' not in request.files:
            return jsonify({'error': 'Missing image or mask file'}), 400
        
        # Save uploaded files temporarily
        image_file = request.files['image']
        mask_file = request.files['mask']
        
        # Convert files to PIL Images
        image = Image.open(image_file).convert('RGB')
        mask = Image.open(mask_file).convert('L')
        
        # Resize images to match model requirements
        image = image.resize((128, 128))
        mask = mask.resize((128, 128))
        
        # Invert mask (black becomes the area to inpaint)
        mask = Image.fromarray(255 - np.array(mask))
        
        # Generate inpainting
        prompt = "Fill this image based on the context of this image"
        output = pipe(
            prompt=prompt,
            image=image,
            mask_image=mask,
            num_inference_steps=50,
            guidance_scale=7.5
        )
        
        # Generate unique filename and save path
        filename = generate_unique_filename()
        output_path = os.path.join(OUTPUT_DIR, filename)
        
        # Save the generated image
        output.images[0].save(output_path)
        
        return jsonify({
            'status': 'success',
            'filename': filename
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/output/<filename>', methods=['GET'])
def get_image(filename):
    try:
        return send_file(
            os.path.join(OUTPUT_DIR, filename),
            mimetype='image/png'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 404

if _name_ == '_main_':
    app.run(host='0.0.0.0', port=3000)