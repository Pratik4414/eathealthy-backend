const express = require ("express");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");

const app = express();

app.use(cors());
app.use(express.json());

// 🔴 Load Indian Food Database
const indianFoods = JSON.parse(
  fs.readFileSync("./data/indianFoods.json", "utf-8")
);

app.post("/get-nutrition", async (req, res) => {
  try {
    const { foodName, quantity = 1 } = req.body;

    if (!foodName) {
      return res.status(400).json({ error: "Food name required" });
    }

    // 🔵 Layer 1 – OpenFoodFacts
    let product = null;

    try {
      const response = await axios.get(
        "https://world.openfoodfacts.org/cgi/search.pl",
        {
          params: {
            search_terms: foodName,
            search_simple: 1,
            action: "process",
            json: 1,
          },
        }
      );

      if (
        response.data &&
        response.data.products &&
        response.data.products.length > 0
      ) {
        product = response.data.products[0];
      }
    } catch (apiError) {
      console.log("OpenFoodFacts API failed, using fallback...");
    }

    if (
      product &&
      product.nutriments &&
      product.nutriments["energy-kcal_100g"]
    ) {
      return res.json({
        source: "OpenFoodFacts",
        name: product.product_name || foodName,
        calories:
          (product.nutriments["energy-kcal_100g"] || 0) * quantity,
        protein:
          (product.nutriments.proteins_100g || 0) * quantity,
        carbs:
          (product.nutriments.carbohydrates_100g || 0) * quantity,
        fats:
          (product.nutriments.fat_100g || 0) * quantity,
      });
    }

    // 🔴 Layer 2 – Local DB
    const match = Object.keys(indianFoods).find((key) =>
      foodName.toLowerCase().includes(key)
    );

    if (match) {
      return res.json({
        source: "Local Indian Database",
        name: match,
        calories: indianFoods[match].calories * quantity,
        protein: indianFoods[match].protein * quantity,
        carbs: indianFoods[match].carbs * quantity,
        fats: indianFoods[match].fats * quantity,
      });
    }

    return res.status(404).json({
      error: "Food not found in both APIs",
    });

  } catch (error) {
    console.error("SERVER ERROR:", error);
    return res.status(500).json({
      error: "Server error occurred",
    });
  }
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
