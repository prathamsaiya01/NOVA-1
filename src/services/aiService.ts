// src/services/aiService.ts

const AI_SERVER = "http://127.0.0.1:8000";

class AIService {
  // Check whether Python AI server is running
  async checkConnection() {
    const response = await fetch(`${AI_SERVER}/health`);

    if (!response.ok) {
      throw new Error("AI Server is not responding");
    }

    return response.json();
  }

  // Send garment image to Python server
  async uploadGarment(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${AI_SERVER}/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Garment upload failed");
    }

    return response.json();
  }

  // Generate vector embedding from Python AI server for similarity search
  async getEmbedding(file: File): Promise<number[]> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${AI_SERVER}/embed`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Failed to generate image embedding");
    }

    const data = await response.json();
    return data.embedding; // Expects an array of floats e.g. [0.12, -0.45, ...]
  }
}

export default new AIService();